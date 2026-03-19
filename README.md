# Real-time Chat

> A production-structured monorepo demonstrating real-time WebSocket communication across three clients — browser, iOS, and Android — from a single Node.js server. No accounts. No persistence layer. Open the app, pick a display name, and start chatting.

**[→ Live Demo](https://real-time-chat-johnlester-0369.onrender.com)**

[![Server](https://img.shields.io/badge/server-Express%20%2B%20Socket.IO-000?logo=node.js&logoColor=white)](packages/server)
[![Web](https://img.shields.io/badge/web-React%2019%20%2B%20Vite-61dafb?logo=react&logoColor=white)](packages/web)
[![Mobile](https://img.shields.io/badge/mobile-Expo%2054%20%2F%20React%20Native-000020?logo=expo&logoColor=white)](packages/mobile)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://typescriptlang.org)

The `general` room keeps a 100-message ring buffer, reconnects silently after network drops, deduplicates multi-tab sessions, and preserves display names through a 5-second grace period — a browser refresh doesn't broadcast "Alex left the room."

---

## Quick Start

**Prerequisites:** Node.js ≥ 18, npm ≥ 10. For mobile: Expo Go on a physical device or a local simulator.
````bash
# Clone and install all packages
git clone https://github.com/johnlester-0369/real-time-chat.git
cd real-time-chat
make install

# Copy the server environment template
make env-setup

# Start the web client and server together
make dev
````

Open `http://localhost:5173`, enter a display name, and send your first message.

For mobile, see [packages/mobile/README.md](packages/mobile/README.md) — set `EXPO_PUBLIC_SOCKET_URL` to your machine's LAN IP before scanning the QR code in Expo Go.

---

## Packages

| Package | What it is | Docs |
|---|---|---|
| [`packages/server`](packages/server) | Express HTTP server + Socket.IO WebSocket layer. Single persistent `general` room, typed event protocol, in-memory state. Serves all three clients simultaneously. | [README →](packages/server/README.md) |
| [`packages/web`](packages/web) | React 19 + Vite browser client. URL-based session identity (no `localStorage`), CSS custom property theming, Material Design 3 component system, strict TypeScript throughout. | [README →](packages/web/README.md) |
| [`packages/mobile`](packages/mobile) | Expo SDK 54 + React Native client for iOS and Android. Mirrors the web package's domain architecture so Socket.IO protocol knowledge transfers across platforms without translation. | [README →](packages/mobile/README.md) |

---

## Architecture
```
┌──────────────────────────────────────────┐
│             packages/server              │
│  Express · Socket.IO 4.8 · Node.js ESM   │
│  GET /health · GET /                     │
│  WS events: room:history · room:users    │
│             message:new · error          │
└────────────────────┬─────────────────────┘
                     │  WebSocket (Socket.IO)
          ┌──────────┴──────────┐
          │                     │
┌─────────▼────────┐   ┌────────▼───────────────┐
│  packages/web    │   │   packages/mobile      │
│  React 19        │   │   Expo 54              │
│  Vite · Tailwind │   │   React Native 0.81    │
│  Browser         │   │   iOS + Android        │
└──────────────────┘   └────────────────────────┘
```

### Domain Pattern

Both clients use the same layered architecture inside their `chat/` directory. The UI layer never calls `socket.emit` or `socket.on` directly — all socket access routes through a single barrel import:
```
App.tsx / app/index.tsx
    └─ import { useSocket } from '@/chat'     ← only import surface
         ├─ chat/hooks/useSocket.ts           React state + effect lifecycle
         │    └─ chat/services/socket.service.ts    typed emit/subscribe
         │         └─ chat/lib/socket-client.ts     Socket.IO singleton (lazy-init)
         └─ chat/dtos/chat.dto.ts             wire-contract types (re-exported)
```

Changing the transport layer requires changes only inside `chat/` — the app shell is untouched.

---

## Tech Stack

| Concern | Technology |
|---|---|
| Server runtime | Node.js (ESM, `"type": "module"`) |
| WebSocket | Socket.IO 4.8 |
| Web UI | React 19, Vite 8, Tailwind CSS 3.4 |
| Mobile UI | Expo SDK 54, React Native 0.81 |
| Language | TypeScript 5.9 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Icons (web) | Lucide React |
| Icons (mobile) | @expo/vector-icons |
| Storage (mobile) | @react-native-async-storage/async-storage |
| Build tooling | tsx watch (server dev), Vite (web), Metro (mobile) |

---

## Make Commands

Run `make help` for the full command list with descriptions.

| Command | Description |
|---|---|
| `make install` | Install dependencies for all three packages |
| `make dev` | Start web + server in parallel (web: 5173 · server: 3000) |
| `make dev-mobile` | Start Expo dev server for iOS / Android |
| `make build` | Production build for web + server |
| `make lint` | ESLint across all packages |
| `make format` | Prettier for web + server (mobile uses ESLint only) |
| `make clean` | Remove build artifacts (`dist/`, Expo cache) |
| `make clean-all` | Remove build artifacts and all `node_modules` |
| `make fresh` | `clean-all` then `install` — full reset |
| `make env-setup` | Copy `server/.env.example` → `server/.env` (skips if already exists) |
| `make status` | Show directory paths and package versions |
| `make ports` | Show ports used in development |

---

## Development

### Running Packages Individually
````bash
# Server (tsx watch — restarts on file changes, no compile step)
cd packages/server && npm run dev

# Web (Vite HMR at http://localhost:5173)
cd packages/web && npm run dev

# Mobile (Expo Go QR code / emulator)
cd packages/mobile && npm start
````

### Environment Variables

| Package | Variable | Required | Description |
|---|---|---|---|
| `server` | `PORT` | No | Defaults to `3000`; injected automatically by Railway / Render |
| `server` | `CORS_ORIGIN` | **Prod only** | Comma-separated allowed origins. Omit only in local dev — must be set before deploying. |
| `web` | `VITE_SOCKET_URL` | Yes | Full URL of the server, e.g. `http://localhost:3000`. Baked into the bundle at build time. |
| `mobile` | `EXPO_PUBLIC_SOCKET_URL` | Yes | Must use `https://`, not `wss://`. See [Known Gotchas](packages/mobile/README.md#known-gotchas). |

### Keeping DTOs in Sync

`chat/dtos/chat.dto.ts` is duplicated across all three packages and kept in sync manually — a shared types package is a planned future improvement. When you change an event payload, update all three files and verify each package compiles:
````bash
cd packages/server && npx tsc --noEmit
cd packages/web    && npx tsc -b
cd packages/mobile && npx tsc --noEmit
````

---

## Deployment

The server and web packages are deployed to [Render](https://render.com).

**Server:** Set `CORS_ORIGIN` to your frontend URL before deploying. The origin callback handles all three client types (browser, iOS, Android) from a single function — see the [CORS Strategy](packages/server/README.md#cors-strategy) section of the server README for the full reasoning.

**Web:** Set `VITE_SOCKET_URL` as a build-time environment variable on your hosting platform — it takes precedence over the committed `.env.production` file.

**Mobile:** Expo Go connects to the deployed server directly. Point `EXPO_PUBLIC_SOCKET_URL` at your production server URL for testing against production. For OTA or store builds, configure via EAS environment variables.

---

## License

MIT