# Real-time Chat — Web

> Building a browser chat UI means solving three problems at once: a WebSocket connection that drops and must rejoin transparently, a user identity that survives page refresh without an account, and React state that stays decoupled from the wire protocol. This package solves all three.

React 19 + Vite 8 + Socket.IO client. Connects to the `packages/server` backend. Light/dark theming via CSS custom properties, Material Design 3–inspired component system, strict TypeScript throughout.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI runtime | React | 19.x |
| Language | TypeScript | ~5.9 |
| Build tool | Vite | 8.x |
| Styling | Tailwind CSS + PostCSS | 3.4.x |
| Real-time transport | Socket.IO client | 4.8.x |
| Icons | Lucide React | 0.577.x |

---

## Quick Start — First Message in 60 Seconds

**Prerequisites:** Node.js 20+, npm 10+, `packages/server` running on `http://localhost:3000`.
````bash
npm install
npm run dev
````

Open `http://localhost:5173`, enter a display name, and send your first message.

The server URL is read from `.env.development`. To point at a different host without touching committed files:
````bash
# packages/web/.env.development.local  (git-ignored)
VITE_SOCKET_URL=http://192.168.1.100:3000
```

---

## Project Structure
```
packages/web/
├── index.html                   # HTML shell — Vite entry point
├── vite.config.ts               # Vite config: @vitejs/plugin-react, @/ path alias
├── tsconfig.app.json            # Strict TypeScript config for src/
├── tsconfig.node.json           # TypeScript config for vite.config.ts
├── .env.development             # VITE_SOCKET_URL for local dev
├── .env.production              # VITE_SOCKET_URL for production build
│
└── src/
    ├── main.tsx                 # Entry: synchronous theme init → React root
    ├── App.tsx                  # Root component: chat shell, message list, input bar
    │
    ├── chat/                    # Chat domain — all socket/protocol logic
    │   ├── index.ts             # Public API barrel — the only import surface for App.tsx
    │   ├── dtos/
    │   │   └── chat.dto.ts      # Wire-contract types: Message, ChatUser, UserColor, event maps
    │   ├── hooks/
    │   │   └── useSocket.ts     # React hook — orchestrates state for the socket connection
    │   ├── lib/
    │   │   └── socket-client.ts # Singleton Socket.IO instance factory (lazy-init)
    │   ├── models/
    │   │   └── chat.model.ts    # Client-only state types: Room aggregate
    │   └── services/
    │       └── socket.service.ts # Protocol adapter: typed emit/subscribe
    │
    ├── components/
    │   ├── chat/
    │   │   └── NameEntryScreen.tsx  # Name entry gate before joining the room
    │   └── ui/
    │       ├── buttons/
    │       │   └── IconButton.tsx   # Polymorphic icon button with M3 state layers
    │       └── data-display/
    │           ├── Avatar.tsx       # Compound avatar: Root / Image / Fallback / Group
    │           └── Status.tsx       # Compound status indicator: Root / Indicator
    │
    ├── contexts/
    │   └── ThemeContext.tsx     # ThemeProvider + useTheme hook
    │
    ├── utils/
    │   ├── cn.util.ts           # Class name joiner (filters falsy values)
    │   ├── polymorphic.util.ts  # forwardRefWithAs — typed `as` prop pattern
    │   └── theme.util.ts        # Theme read/write/validate/apply utilities
    │
    └── styles/
        ├── globals.css          # PostCSS entry point — imports all layers in order
        ├── tokens.css           # Design tokens: typography, spacing, motion, shadows
        ├── base.css             # @layer base — element defaults, scrollbar normalisation
        ├── utilities.css        # @layer utilities — .scrollbar-hidden, .scrollbar-default
        ├── animations.css       # @keyframes library for Tailwind animate-* classes
        └── theme/
            ├── light.css        # --light-color-* definitions + :root reference layer
            └── dark.css         # --dark-color-* definitions + .dark override layer
````

---

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm** 10 or later
- The `packages/server` backend running and reachable (default: `http://localhost:3000`)

### Install
````bash
npm install
````

### Development
````bash
npm run dev
````

Starts the Vite dev server at `http://localhost:5173` with HMR. Reads `VITE_SOCKET_URL` from `.env.development`.

### Production Build
````bash
npm run build
````

Runs `tsc -b` (full type check) then `vite build`. Output goes to `dist/`. Reads `VITE_SOCKET_URL` from `.env.production`.

### Preview Built Output
````bash
npm run preview
````

Serves the production `dist/` build locally for pre-deploy verification.

### Lint and Format
````bash
npm run lint      # ESLint
npm run format    # Prettier — writes in place
````

---

## Environment Variables

All variables require the `VITE_` prefix — Vite strips unprefixed variables from the browser bundle at build time.

| Variable | Required | Description |
|---|---|---|
| `VITE_SOCKET_URL` | ✅ | Full URL of the Socket.IO server, e.g. `http://localhost:3000`. A missing value throws at startup rather than silently failing to connect. |

**Override for a specific machine** without touching committed files:
````bash
# packages/web/.env.development.local  (git-ignored)
VITE_SOCKET_URL=http://192.168.1.100:3000
````

**In CI/CD or on hosting platforms** (Vercel, Railway, Fly.io), set `VITE_SOCKET_URL` as a build-time environment variable — it takes precedence over the committed `.env.production` file.

---

## Architecture

### Domain Boundary — Why Everything Lives in `chat/`

All socket, protocol, and chat-state logic is encapsulated inside `src/chat/`. Nothing outside that directory calls `socket.emit` or `socket.on` directly. `App.tsx` imports exclusively from the barrel:
````ts
import { useSocket } from '@/chat'
import type { Message, UserColor } from '@/chat'
````

This keeps the wire protocol evolvable independently of the UI layer. If the backend switches from Socket.IO to a different transport, only the `chat/` internals change — `App.tsx` is untouched.

### Socket Layer Stack — Three Responsibilities, Three Files

Three files own distinct responsibilities in strict dependency order:
```
useSocket.ts (chat/hooks/)
    React state transitions and effect lifecycle only.
    Calls socketService.subscribe() once; maps incoming events to setState.
        ↓
socket.service.ts (chat/services/)
    Protocol adapter — typed emit/subscribe over the singleton socket.
    subscribe(handlers) attaches all listeners and returns a symmetric cleanup
    function, guaranteeing subscribe/unsubscribe symmetry without caller
    needing to hold handler references.
        ↓
socket-client.ts (chat/lib/)
    Singleton Socket.IO instance. Lazy-initialised on first call so no TCP
    handshake fires until a component mounts. Module-private to prevent
    split-brain scenarios from external reference replacement.
```

**Join handshake resilience:** `useSocket` runs two effects to cover both join paths. The `onConnect` handler replays `user:join` on every reconnection so the user remains visible in the room after a network drop. A separate deferred effect fires when `user` transitions from `null` to a value mid-session — covering the case where the socket connects before the name is entered.

### URL-Based Session Identity — Why Not `localStorage`

User identity (`userId` + `name`) is stored in URL query parameters rather than `localStorage`:
```
http://localhost:5173/?userId=550e8400-e29b-41d4-a716-446655440000&name=Alex
````

This means:
- **Page refresh restores the session** — no re-entry of name required.
- **The UUID is visible in the address bar** — simplifies debugging reconnect issues.
- **No storage permission or account required** — the name entry screen states this explicitly.

`getUrlIdentity()` in `App.tsx` reads params synchronously as the lazy initialiser of `useState`, matching the `localStorage.getItem()` pattern with zero flash of `NameEntryScreen` on refresh.

> **Note — `userColor` is currently hardcoded to `'info'`** in `App.tsx`. The comment in source marks this as a candidate for derivation from a username hash to give each user a distinct avatar color automatically. Until that is implemented, all messages from the current user display with the `info` color role.

### Theme System — No Runtime Style Injection

Themes are implemented entirely via CSS custom properties — no JavaScript writes inline styles. Three concerns are separated:

1. **Value definitions** — `theme/light.css` and `theme/dark.css` define `--light-color-*` and `--dark-color-*` prefixed variables in `:root`. All raw values are globally accessible at all times regardless of active theme.
2. **Reference layer** — A second `:root` block in `light.css` maps canonical `--color-*` variables to light values. The `.dark` block in `dark.css` overrides the same canonical names when `.dark` is present on `<html>`.
3. **Application** — `ThemeContext` wraps `applyTheme()` from `theme.util.ts`, which adds/removes the `.dark` class on `document.documentElement`. `main.tsx` calls this synchronously before React renders to prevent a flash of wrong theme.

---

## Chat Domain Public API

Import everything from `@/chat`. Do not reach into subdirectories directly — they are implementation details of the domain.
````ts
// React hook — primary interface
import { useSocket } from '@/chat'
import type { UseSocketUser, UseSocketReturn } from '@/chat'

// Wire-contract types
import type { Message, ChatUser, UserColor } from '@/chat'
````

### `useSocket(user?: UseSocketUser | null): UseSocketReturn`

Connects to the chat server and exposes reactive state. Pass `null` to defer joining — used on `NameEntryScreen` before identity is known. The socket connection opens immediately regardless; only the `user:join` handshake is deferred.
````ts
interface UseSocketUser {
  userId: string   // stable client-generated UUID — set once on name submit, stored in URL
  name: string
  color: UserColor
}

interface UseSocketReturn {
  isConnected: boolean
  messages: Message[]
  users: ChatUser[]
  sendMessage: (text: string) => void
  error: string | null
  clearError: () => void  // dismiss socket errors — used when retrying after a rejected join
}
````

`Date` fields (`message.timestamp`, `user.joinedAt`) arrive as ISO strings over the wire and are coerced to `Date` objects inside the hook — callers always receive real `Date` instances.

### Wire-Contract Types (`chat/dtos/chat.dto.ts`)

These types mirror the server-side `chat/dtos/chat.dto.ts` and must be kept in sync manually until a shared types package is introduced.
````ts
interface Message {
  id: string
  userId: string
  userName: string
  userColor: string   // one of the UserColor values; 'system' userId indicates a join/leave event
  text: string
  timestamp: Date     // coerced from ISO string by useSocket
}

type UserColor =
  | 'primary' | 'secondary' | 'tertiary'
  | 'success' | 'warning' | 'info' | 'neutral'

interface ChatUser {
  id: string       // stable UUID — not socket.id; persists across reconnections
  name: string
  color: UserColor
  joinedAt: Date   // coerced from ISO string by useSocket
}
````

### Socket Events Reference

| Direction | Event | Payload |
|---|---|---|
| Server → Client | `room:history` | `{ room: string; messages: Message[]; users: ChatUser[] }` |
| Server → Client | `room:users` | `ChatUser[]` |
| Server → Client | `message:new` | `Message` |
| Server → Client | `error` | `{ message: string }` |
| Client → Server | `user:join` | `{ userId: string; name: string; color: UserColor }` |
| Client → Server | `message:send` | `{ text: string }` |

System events (user join/leave) arrive as `Message` records with `userId === 'system'` and are rendered as centred muted text rather than chat bubbles.

---

## UI Components

All UI primitives live in `src/components/ui/`. They are design-system components — not chat-feature-specific and carry no socket or domain dependencies.

### `Avatar` — Compound Component
````tsx
import Avatar from '@/components/ui/data-display/Avatar'

// Initials fallback
<Avatar.Root size="md" color="primary" variant="subtle" name="Alex Chen">
  <Avatar.Fallback />
</Avatar.Root>

// With image — Fallback shown while image loads or on error
<Avatar.Root size="lg" color="secondary" name="Sam">
  <Avatar.Image src="/avatars/sam.jpg" alt="Sam" />
  <Avatar.Fallback />
</Avatar.Root>

// Grouped with overlap
<Avatar.Group spacing="-0.5rem">
  <Avatar.Root size="sm" color="primary" name="A"><Avatar.Fallback /></Avatar.Root>
  <Avatar.Root size="sm" color="secondary" name="B"><Avatar.Fallback /></Avatar.Root>
</Avatar.Group>
````

**`Avatar.Root` props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` | Dimensions (6×6 → 20×20 rem scale) |
| `variant` | `'solid' \| 'subtle' \| 'outline'` | `'subtle'` | Background style |
| `shape` | `'circle' \| 'square' \| 'rounded'` | `'circle'` | Border radius |
| `color` | `AvatarColor` | `'primary'` | Color role |
| `name` | `string` | — | Derives initials; used as `aria-label` on fallback |
| `as` | `React.ElementType` | `'div'` | Polymorphic element |

`AvatarColor`: `primary | secondary | tertiary | success | error | warning | info | neutral`

**`Avatar.Group` props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `spacing` | `string` | `'-0.5rem'` | CSS gap between overlapping avatars (negative = overlap) |

### `Status` — Compound Component
````tsx
import Status from '@/components/ui/data-display/Status'

// Dot only (e.g. in a header)
<Status.Indicator colorPalette="success" size="sm" pulse />

// Dot + label text
<Status.Root colorPalette="success" size="md">
  <Status.Indicator />
  Online
</Status.Root>
````

**`Status.Indicator` props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `colorPalette` | `'success' \| 'error' \| 'warning' \| 'info' \| 'primary' \| 'secondary'` | `'success'` | Dot color role |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Dot dimensions (6px → 10px) |
| `pulse` | `boolean` | `false` | Applies `animate-pulse` for live/connecting states |

**`Status.Root` props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `colorPalette` | `StatusColor` | `'success'` | Text color role |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Text size and gap scale |

### `IconButton`

Square button with a single icon. Supports all M3 interaction states via `::after` pseudo-element state layers for filled variants, and direct background opacity for `text`/`outline` variants.
````tsx
import IconButton from '@/components/ui/buttons/IconButton'
import { Send, Settings } from 'lucide-react'

// Default (text variant — transparent, neutral color)
<IconButton icon={<Send />} aria-label="Send message" />

// Filled primary — for emphasis
<IconButton icon={<Send />} variant="primary" size="sm" aria-label="Send" />

// Polymorphic — renders as <a>
<IconButton as="a" href="/settings" icon={<Settings />} aria-label="Settings" />

// Loading state — icon replaced by animated spinner
<IconButton icon={<Send />} isLoading aria-label="Sending..." />
````

**Props**

| Prop | Type | Default | Description |
|---|---|---|---|
| `icon` | `React.ReactNode` | — | Icon element; sized automatically by the `size` prop |
| `variant` | `'text' \| 'primary' \| 'secondary' \| 'tertiary' \| 'outline' \| 'danger'` | `'text'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Square dimensions: 32px / 40px / 48px |
| `isLoading` | `boolean` | `false` | Replaces icon with animated spinner; sets `aria-busy` |
| `aria-label` | `string` | — | **Required** — icon buttons have no visible text |
| `as` | `React.ElementType` | `'button'` | Polymorphic element |

---

## Polymorphic Component Pattern

`Avatar.Root`, `Avatar.Image`, `Avatar.Fallback`, `Avatar.Group`, `Status.Root`, `Status.Indicator`, and `IconButton` all accept an `as` prop via `forwardRefWithAs` from `utils/polymorphic.util.ts`. This renders the component as any HTML element or React component while preserving full TypeScript type safety for the resulting props.
````tsx
// Renders as <a> — href becomes a typed, required prop
<IconButton as="a" href="/path" icon={<ArrowLeft />} aria-label="Back" />

// Renders as React Router Link — to becomes a typed prop
<IconButton as={Link} to="/settings" icon={<Settings />} aria-label="Settings" />
````

---

## Design Tokens

All tokens are CSS custom properties defined in `src/styles/tokens.css` and mapped into Tailwind via `tailwind.config.js`.

### Typography Scale

Tailwind classes follow the pattern `text-{role}-{size}`:

| Class | Size | Line Height | Weight | WCAG |
|---|---|---|---|---|
| `text-display-lg` | 57px | 1.12 | 400 | Large text |
| `text-display-md` | 45px | 1.16 | 400 | Large text |
| `text-headline-lg` | 32px | 1.25 | 400 | Large text |
| `text-headline-md` | 28px | 1.29 | 400 | Large text |
| `text-headline-sm` | 24px | 1.33 | 400 | Large text |
| `text-title-lg` | 22px | 1.27 | 400 | Large text |
| `text-title-md` | 16px | 1.5 | 500 | AA ✅ |
| `text-title-sm` | 14px | 1.5 | 500 | AA ✅ |
| `text-body-lg` | 18px | 1.6 | 400 | AA ✅ |
| `text-body-md` | 16px | 1.5 | 400 | AA ✅ |
| `text-body-sm` | 14px | 1.5 | 400 | AA ✅ |
| `text-label-lg` | 14px | 1.5 | 500 | AA ✅ |
| `text-label-md` | 13px | 1.5 | 500 | AA ✅ |
| `text-label-sm` | 12px | 1.5 | 500 | AA ✅ |

All body and label sizes meet WCAG 2.1/2.2 minimum line-height requirements (1.5+).

### Motion Tokens
````css
/* Semantic durations — use these, not raw values */
--duration-fast:   150ms   /* micro-interactions: button press, toggle */
--duration-normal: 300ms   /* standard transitions: panel open/close */
--duration-slow:   400ms   /* emphasis: modal enter */
--duration-slower: 500ms   /* page-level transitions */

/* Easing curves */
--easing-standard:            cubic-bezier(0.2, 0, 0, 1)
--easing-emphasized:          cubic-bezier(0.2, 0, 0, 1)
--easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1)
--easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15)
````

Tailwind classes: `duration-fast`, `duration-normal`, `duration-slow`, `ease-standard`, `ease-emphasized`.

### Shadow / Elevation Tokens

Five M3 elevation levels map to Tailwind `shadow-elevation-{0–5}`. Each level also ships `*-soft`, `*-medium`, and `*-hard` intensity variants for fine-grained control. Glow variants for interactive states: `shadow-glow-sm`, `shadow-glow-md`, `shadow-glow-lg` (primary-colored halos).

### State Layer Opacity Tokens

Used by interactive components for M3-compliant hover/press states:

| State | Token | Value | Tailwind Usage |
|---|---|---|---|
| Hover | `--state-hover-opacity` | `0.08` | `hover:bg-on-surface/[var(--state-hover-opacity)]` |
| Focus | `--state-focus-opacity` | `0.12` | `focus:bg-on-surface/[var(--state-focus-opacity)]` |
| Pressed | `--state-pressed-opacity` | `0.12` | `active:bg-on-surface/[var(--state-pressed-opacity)]` |
| Disabled | `--state-disabled-opacity` | `0.38` | `disabled:opacity-state-disabled` |

---

## CSS Layer Composition

`globals.css` is the sole PostCSS entry point. It composes all style layers in strict dependency order:
```
theme/light.css     → --light-color-* definitions + :root reference layer (light defaults)
theme/dark.css      → --dark-color-* definitions + .dark override layer
        ↓
tokens.css          → Typography, spacing, motion, layout (z-index), shadows, state opacity
        ↓
base.css            → @layer base — element defaults, scrollbars, reduced-motion opt-out
        ↓
utilities.css       → @layer utilities — .scrollbar / .scrollbar-default / .scrollbar-hidden
        ↓
animations.css      → @keyframes — fade-in, slide-in, scale-in, shimmer, skeleton, progress…
        ↓
@tailwind base / components / utilities
````

`@import` declarations appear before `@tailwind` directives so PostCSS-import inlines all `@layer` declarations before Tailwind resolves injection order.

### Scrollbar Utilities

| Class | Behaviour |
|---|---|
| _(none)_ | All non-`html` elements automatically get a styled thin scrollbar via `base.css` |
| `.scrollbar` | Explicitly re-apply styled scrollbar (after a parent used `.scrollbar-default`) |
| `.scrollbar-default` | Reset to the browser's native OS scrollbar |
| `.scrollbar-hidden` | Hide scrollbar while preserving scroll functionality |

Dark mode scrollbar colors are adjusted automatically by `.dark *:not(html)` rules in `base.css`.

---

## Path Alias

`@/` resolves to `src/` in both TypeScript (`tsconfig.app.json → paths`) and Vite (`vite.config.ts → resolve.alias`). Both configs must stay in sync — Vite resolves modules independently of TypeScript.
````ts
// Instead of:
import { cn } from '../../../utils/cn.util'

// Use:
import { cn } from '@/utils/cn.util'
````