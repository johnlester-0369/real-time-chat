# Real-time Chat — Server

> Real-time chat backend for the `real-time-chat` monorepo — **Express** HTTP layer, **Socket.IO** WebSocket transport, single persistent `general` room. Serves web (Vite + React), iOS (Expo), and Android (Expo) clients simultaneously from a single deployable Node.js process.

## The Problem

Most Socket.IO tutorials collapse CORS configuration, room state management, and event handler logic into a single file. This server separates those concerns across a typed domain layer so each piece is independently understandable, testable, and replaceable:

- **Transport infrastructure** (CORS origin callback, mobile heartbeat tuning, singleton lifecycle) → `chat/lib/`
- **Business logic** (join/leave, name uniqueness, reconnect grace period, multi-tab deduplication, message ring buffer) → `chat/services/`
- **Wire contracts** (serialisable event shapes shared with all client packages) → `chat/dtos/`
- **Internal state shapes** (in-memory `Map`, `setTimeout` handles, `socketId`) → `chat/models/`

The result: `server.ts` and `app.ts` know nothing about chat internals. `chat/index.ts` is the single import that wires the domain to the app shell — internal refactors within `chat/` cannot cascade into the shell.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Folder Structure](#folder-structure)
4. [Environment Variables](#environment-variables)
5. [HTTP Endpoints](#http-endpoints)
6. [Socket.IO Protocol](#socketio-protocol)
7. [Room Behaviour](#room-behaviour)
8. [CORS Strategy](#cors-strategy)
9. [Scripts](#scripts)
10. [Deployment](#deployment)
11. [Technical Notes](#technical-notes)

---

## Quick Start
````bash
# 1. Install dependencies
npm install

# 2. Copy the environment template
cp .env.example .env
# Edit .env — set CORS_ORIGIN to your frontend URL (see Environment Variables)

# 3. Start the dev server (tsx watch — no separate compile step)
npm run dev
````

Server starts on `http://localhost:3000` by default.

Verify it is running:
````bash
curl http://localhost:3000/health
# → {"status":"ok"}
````

---

## Architecture

The server follows **domain-based architecture** — all chat concerns live inside `src/chat/` and are exposed through a single entry point. `server.ts` and `app.ts` form the thin app shell that knows nothing about chat internals.
```
app shell
├── server.ts          Boot: creates HTTP server, attaches WebSocket, handles SIGTERM
└── app.ts             Express factory: JSON middleware, /health probe, / root route

chat domain  (src/chat/)
├── index.ts           Public entry point — pure wiring, zero business logic
├── lib/
│   └── socket-server.ts   SocketServer singleton + CORS origin callback
├── services/
│   └── room.service.ts    All room state and event-handler logic
├── models/
│   └── room.model.ts      Server-internal types (UserRecord, Room, PendingDisconnectEntry)
└── dtos/
    └── chat.dto.ts        Wire-contract types shared with all client packages
```

**Why this layer separation?**

| Layer | Holds | Deliberately excludes |
|---|---|---|
| `dtos/` | Serialisable, wire-contract types only | `socketId`, `Map`, `setTimeout` handles — anything non-serialisable |
| `models/` | Server-internal state shapes | Any type that crosses the network boundary |
| `services/` | Business logic, room state, event handler methods | Socket infrastructure, transport concerns |
| `lib/` | SocketServer singleton, CORS callback, heartbeat config | Business logic of any kind |
| `index.ts` | Socket.IO event binding only | Anything that would cause changes here on a domain refactor |

`chat/index.ts` is the **only** file `server.ts` imports from the chat domain. A complete rewrite of `room.service.ts` or `socket-server.ts` requires zero changes in `server.ts`.

---

## Folder Structure
```
src/
├── server.ts                    Entry point — boots HTTP + WebSocket server
├── app.ts                       Express app factory (JSON middleware, routes)
└── chat/
    ├── index.ts                 Domain public API — exports setupSocketServer()
    ├── dtos/
    │   └── chat.dto.ts          Wire-contract interfaces + typed Socket.IO event maps
    ├── lib/
    │   └── socket-server.ts     SocketServer singleton factory
    │                            (initSocketServer / getSocketServer / resetSocketServer)
    ├── models/
    │   └── room.model.ts        Server-internal types: UserRecord, Room, PendingDisconnectEntry
    └── services/
        └── room.service.ts      RoomService class + roomService singleton
````

---

## Environment Variables

Copy `.env.example` to `.env` for local development. In production, set these via your platform's variable UI (Railway, Render, etc.).

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP server port. Railway and Render inject this automatically. |
| `CORS_ORIGIN` | No (dev) / **Yes (prod)** | *(allow all)* | Comma-separated list of origins permitted to connect. Omitting falls back to allowing all origins — safe for local dev, **must be set in production**. |

**`CORS_ORIGIN` examples:**
````bash
# Local dev
CORS_ORIGIN=http://localhost:5173,http://localhost:4173

# Single production frontend
CORS_ORIGIN=https://your-app.vercel.app

# Multiple frontends (web + staging)
CORS_ORIGIN=https://your-frontend.onrender.com,https://your-app.vercel.app
````

> **`SERVER_URL` is no longer needed.** Android React Native (new arch / Hermes) echoes the server's own deployed URL as the `Origin` header. This is now handled by the `origin.startsWith('https://')` branch in the CORS callback — no separate env var required.

---

## HTTP Endpoints

Served on the same port as the WebSocket server.

| Method | Path | Response | Description |
|---|---|---|---|
| `GET` | `/health` | `{ "status": "ok" }` | Liveness probe. Zero dependencies — never false-negatives. Point load balancer and Kubernetes readiness checks here. |
| `GET` | `/` | `{ "message": "Real-time Chat API", "status": "running", "version": "1.0.0" }` | Root info endpoint. No sensitive data exposed. |

---

## Socket.IO Protocol

All event types are defined in `src/chat/dtos/chat.dto.ts` and kept in sync with the client packages (`packages/web` and `packages/mobile`) manually until a shared types package is introduced across the monorepo.

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `user:join` | `{ userId: string; name: string; color: string }` | Registers the client in the room. `userId` is a stable, client-generated UUID that persists across browser refreshes (stored in URL params). Must be emitted before `message:send`. |
| `message:send` | `{ text: string }` | Broadcasts a new message to all connected clients. Rejected with an `error` event if `user:join` has not been emitted first. |

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `room:history` | `{ room: string; messages: Message[]; users: ClientUser[] }` | Emitted immediately on connection — before `user:join`. Seeds the client with the current message history and online user list so the UI populates from the moment the socket opens. |
| `room:users` | `ClientUser[]` | Broadcast to all clients whenever the online user list changes (join, leave, name update). Deduplicated by `userId` — multiple open tabs count as one user. |
| `message:new` | `Message` | Broadcast to all clients for every new message, including system announcements (join/leave). |
| `error` | `{ message: string }` | Sent to the originating socket only. Causes: name already taken; `message:send` before `user:join`. |

### Type Definitions
````ts
// src/chat/dtos/chat.dto.ts

interface Message {
  id: string;        // crypto.randomUUID()
  userId: string;    // stable client UUID; 'system' for server announcements
  userName: string;
  userColor: string;
  text: string;
  timestamp: Date;
}

// Client-safe projection — strips socketId (internal transport detail)
// and remaps userId → id to match the web client's ChatUser shape
interface ClientUser {
  id: string;        // stable client UUID
  name: string;
  color: string;
  joinedAt: Date;
}
````

---

## Room Behaviour

### Single Room

One persistent `general` room, pre-seeded with two welcome messages at class instantiation — not on first connection. Conditional seeding caused duplicate welcome messages whenever the room emptied and a new connection arrived; unconditional instantiation-time seeding eliminates this.

### Message Ring Buffer

The room keeps a maximum of **100 messages** in memory. When the cap is reached, `slice(-100)` discards the oldest messages. This prevents unbounded memory growth while preserving enough history to be useful for late-joining clients.

### Reconnect Grace Period

When a socket disconnects, the server defers the `"left the room"` broadcast for **5 seconds**. If the same client UUID reconnects within that window (browser refresh, brief network drop), the pending timer is cancelled and the user is silently restored — no leave/join notification spam.

The grace window is keyed by client UUID (stable, from URL params) rather than `socketId` (changes on every reconnect). A browser refresh therefore produces a new `socketId` but is still correctly identified as the same user.

### Multi-Tab Support

`generalRoom.users` is keyed by `socketId`, so a user with multiple tabs open has one entry per tab. Before emitting `room:users`, the server deduplicates by `userId` (last-write-wins on duplicate) so the "X online" count reflects unique users, not open tabs. A `"left"` announcement is only emitted when the `userId` has no remaining active sockets — closing one of N tabs stays silent.

### Name Uniqueness

A name is "taken" only if a *different* `userId` currently holds it. A known UUID reclaiming its own name after grace expiry is always permitted — the `userRegistry` reserved the name for them. This allows returning users who were away long enough for the grace period to expire to reclaim their display name without conflict.

### User Registry

A `userRegistry` (`Map<userId, { name, color, joinedAt }>`) persists across reconnects and grace-period expirations. It preserves a user's original `joinedAt` timestamp so room tenure is not reset on re-entry.

---

## CORS Strategy

The origin callback in `chat/lib/socket-server.ts` handles three distinct client types with a single function:

| Client Type | Origin Header | Decision |
|---|---|---|
| iOS React Native (old + new arch) | Absent | Allowed — `!origin` branch |
| Android React Native (string `"null"`) | `"null"` | Allowed — `origin === 'null'` branch |
| Android React Native new arch / Hermes | `https://your-server.railway.app` | Allowed — `origin.startsWith('https://')` branch |
| Browser (Vite dev server, production web app) | Full origin URL | Checked against `CORS_ORIGIN` allowlist in prod; all allowed in dev (empty allowlist) |
| Plain `http://` not on allowlist | `http://...` | **Rejected** — guards against LAN-based browser attacks |

**Why blanket HTTPS-origin acceptance is safe for native clients:**
CORS is a browser security model — native apps are not subject to it. A native app already controls its own request headers, so the `Origin` value carries no trust weight. Real per-socket security must live in authentication middleware (JWT checks on the `connection` event), not in the `Origin` header.

**Why `credentials: true`:**
The Fetch spec forbids combining `credentials: true` with `origin: '*'`. The dynamic callback echoes the specific request origin back so the browser sees `Access-Control-Allow-Origin: <exact-origin>` rather than a wildcard — required for `credentials: true` to work correctly in browser environments.

### Heartbeat Tuning

| Parameter | Value | Reason |
|---|---|---|
| `pingInterval` | 25 000 ms (default) | How often the server pings connected clients to confirm liveness |
| `pingTimeout` | 60 000 ms (increased from default 20 s) | iOS and Android suspend the JS thread when the app is backgrounded. The default 20 s caused spurious disconnects; 60 s gives the OS time to resume the app before the server declares the socket dead and triggers a full reconnect cycle |

Combined `pingInterval + pingTimeout = 85 000 ms` — safely below the 120 s React Native warning threshold.

---

## Scripts
````bash
npm run dev       # Start with tsx watch — restarts on file changes, no compile step
npm run build     # Compile TypeScript (tsc) then resolve path aliases (tsc-alias)
npm run start     # Run compiled output: node dist/server.js
npm run lint      # Run ESLint
npm run format    # Run Prettier over all files
````

---

## Deployment

### Build
````bash
npm run build
# Outputs compiled JS + declaration files to dist/
````

### Production Start
````bash
npm run start
# Runs dist/server.js — requires all env vars to be set
````

### Required Environment Variables (Production)
````bash
PORT=3000                                    # Injected automatically by Railway / Render
CORS_ORIGIN=https://your-frontend.vercel.app # Must be set — omitting allows all origins
````

### Graceful Shutdown

The server registers a `SIGTERM` handler (sent by Kubernetes, ECS, and Docker during rolling deploys) that calls `server.close()` before `process.exit(0)`. This allows in-flight HTTP and WebSocket requests to drain rather than dropping connections mid-response.

### Health Check

Point your platform's health check at `GET /health`. The endpoint has no dependencies and always returns `200 { "status": "ok" }` as long as the Node process is alive.

---

## Technical Notes

- **Module system:** ESM (`"type": "module"`) with `"moduleResolution": "nodenext"`. All relative imports require `.js` extensions even though source files are `.ts` — the Node ESM loader resolves `.js` references to their `.ts` counterparts at compile time.
- **Path alias:** `@/` resolves to `./src/` at compile time. `tsc-alias` rewrites aliases in the compiled output so `node dist/server.js` works without additional loader flags or `--experimental-specifier-resolution`.
- **TypeScript strictness:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` are all enabled. Type-only imports must use `import type`; index access always returns `T | undefined`.
- **In-memory state:** All room state (messages, users, pending disconnect timers, user registry) lives in the `RoomService` singleton and is lost on server restart. This is intentional for the current scope — no persistence layer is planned.
- **Shared types:** `src/chat/dtos/chat.dto.ts` is kept in sync with `packages/web/src/chat/dtos/chat.dto.ts` and `packages/mobile/chat/dtos/chat.dto.ts` manually until a shared types package is introduced across the monorepo.