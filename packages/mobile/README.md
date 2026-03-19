# Real-time Chat — Mobile

> Single-room public chat for iOS and Android. WebSocket-only Socket.IO client on Expo SDK 54,
> with cross-platform keyboard anchoring, Material Design 3 adaptive theming,
> and persistent identity — no account required.

[![Expo SDK](https://img.shields.io/badge/Expo-54.0.33-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61dafb?logo=react&logoColor=white)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Socket.IO Client](https://img.shields.io/badge/socket.io--client-4.8.3-010101?logo=socket.io)](https://socket.io)

The mobile client is one of three packages in the monorepo (`server` · `web` · `mobile`). It mirrors `packages/web/src/` domain architecture so Socket.IO protocol knowledge, DTO types, and service patterns transfer across platforms without translation.

---

## Quick Start

**Prerequisites:** Node.js ≥ 18, Expo Go on your device, and the `server` package running.

```bash
npm install

# Set your server URL (https://, not wss:// — see Known Gotchas)
echo 'EXPO_PUBLIC_SOCKET_URL=http://YOUR_LOCAL_IP:3000' > .env.development.local

# Start Metro
npm start
```

Scan the QR code in Expo Go. You should see the name-entry screen within 5 seconds. Enter a 2–32 character display name and start sending messages.

> **Android emulator?** Use `10.0.2.2` instead of `localhost` for the server URL — the emulator's loopback does not resolve to the host machine.
> **iOS simulator?** `localhost` resolves directly.

---

## Features

- **Real-time messaging** — persistent WebSocket connection via Socket.IO; WebSocket-only transport, no XHR fallback
- **Identity persistence** — display name stored in `AsyncStorage`; survives app restarts, no account required
- **Adaptive theming** — light/dark follows OS by default, user-overridable, persisted to `AsyncStorage`
- **Cross-platform keyboard handling** — three-ref scroll-anchoring system for both Android and iOS that stays accurate through non-animated programmatic scrolls
- **Material Design 3 colour system** — full palette stored as `ColorTuple` (`readonly [R, G, B]`) for arbitrary alpha composition via `rgba()` at any call site
- **Typed Socket.IO events** — `ServerToClientEvents` and `ClientToServerEvents` interfaces enforced at compile time; TypeScript strict mode project-wide

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Runtime | React Native | 0.81.5 |
| Framework | Expo | ~54.0.33 |
| Navigation | expo-router (file-based) | ~6.0.23 |
| WebSocket | socket.io-client | ^4.8.3 |
| Storage | @react-native-async-storage/async-storage | 2.2.0 |
| Icons | @expo/vector-icons | ^15.0.3 |
| Language | TypeScript (strict) | ~5.9.2 |
| React | React | 19.1.0 |

**Experiments enabled** (`app.json`):
- `typedRoutes: true` — TypeScript types for all expo-router `<Link href>` props and `router.push()` calls
- `reactCompiler: true` — React Compiler auto-memoisation, experimental opt-in (see Known Gotchas)

---

## Prerequisites

- **Node.js** ≥ 18
- **Expo Go** on iOS or Android, or a local simulator/emulator
- The **server** package running and reachable — see [`packages/server/README.md`](../server/README.md)

---

## Getting Started

```bash
npm install

# Copy the environment template — git-ignored; safe to override here
cp .env.development .env.development.local
# Edit .env.development.local and set EXPO_PUBLIC_SOCKET_URL

npm start
# a → Android emulator | i → iOS simulator | scan QR → Expo Go
```

### Environment Variables

Variables are resolved at **build time** by Expo's Metro bundler. Only `EXPO_PUBLIC_*`-prefixed variables are injected into the client bundle — mirrors the web package's `VITE_*` convention.

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SOCKET_URL` | ✅ | Base URL of the Socket.IO server |

**URL format rules:**

```
# ✅ Correct — Socket.IO converts https → wss internally during the WebSocket handshake
EXPO_PUBLIC_SOCKET_URL=https://your-server.example.com

# ❌ Wrong — wss:// is not supported by socket.io-client's URL parser;
#            causes silent connection failures in Expo Go on Android
EXPO_PUBLIC_SOCKET_URL=wss://your-server.example.com
```

The socket client validates and throws immediately on a missing or malformed URL — misconfigured deployments surface before any UI renders.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `expo start` | Start Metro bundler (Expo Go / dev client) |
| `android` | `expo start --android` | Launch on Android emulator |
| `ios` | `expo start --ios` | Launch on iOS simulator |
| `web` | `expo start --web` | Run in browser (mobile layout, limited) |
| `lint` | `expo lint` | ESLint via `eslint-config-expo` |

---

## Project Architecture

Domain-based layout — mirrors `packages/web/src/` so protocol knowledge transfers across platforms:

```
packages/mobile/
├── app/                    # expo-router file-based routes
│   ├── _layout.tsx         # Root layout — ThemeProvider + Stack navigator
│   └── index.tsx           # Route "/" — main chat screen
├── chat/                   # Chat domain — single import surface via barrel
│   ├── dtos/               # Wire-contract types (network boundary)
│   ├── hooks/              # React hooks (useSocket)
│   ├── lib/                # Socket.IO singleton factory
│   ├── models/             # Client-side state aggregates (never serialised)
│   ├── services/           # Protocol adapter (emit/subscribe)
│   └── index.ts            # Public barrel — the only file imported externally
├── components/
│   ├── chat/               # Screen-level components (NameEntryScreen)
│   └── ui/                 # Reusable primitives (Avatar, Status, IconButton)
├── contexts/
│   └── ThemeContext.tsx     # Theme provider + useTheme hook
└── styles/
    ├── theme/
    │   ├── light.ts         # Base palette + ColorTuple type + rgba/rgb helpers
    │   └── dark.ts          # Dark palette overrides (imports ColorTuple from light.ts)
    └── tokens.ts            # Non-colour tokens: typography, spacing, motion, shadows
```

### Path Alias

All internal imports use `@/` mapping to the package root (`./`):

```ts
import { useSocket } from '@/chat';
import { useTheme } from '@/contexts/ThemeContext';
```

Configured in `tsconfig.json`: `"paths": { "@/*": ["./*"] }`.

---

## Chat Domain

`chat/index.ts` is the **only** import surface for the chat domain. Screens import from `@/chat`; nothing reaches into subdirectories directly. This boundary keeps wire-format changes (DTOs) and transport details (Socket.IO) isolated from the UI layer.

```
app/index.tsx
  └─ @/chat  (barrel)
       ├─ chat/hooks/useSocket.ts
       │    └─ chat/services/socket.service.ts
       │         └─ chat/lib/socket-client.ts     ← Socket.IO singleton
       │              └─ chat/dtos/chat.dto.ts    ← wire types
       └─ chat/dtos/chat.dto.ts                   ← re-exported types
```

### Socket Lifecycle

**Connection** — `chat/lib/socket-client.ts` owns the singleton `Socket` instance. Created lazily on first `getSocketClient()` call — no TCP handshake until a chat component mounts.

**Subscription** — `chat/services/socket.service.ts` wraps all `socket.on` / `socket.off` calls. `subscribe(handlers)` returns a symmetric cleanup function for `useEffect` return values, guaranteeing that every listener registered is also removed.

**React StrictMode double-mount safety** — StrictMode double-invokes effects (mount → cleanup → mount). The socket stays connected through the cleanup, so the second mount never receives the `connect` event and `isConnected` would stay `false`. The service detects `socket.connected === true` on re-subscription and immediately invokes `onConnect`, resolving this without special-casing in the hook.

**Deferred join** — `useSocket` accepts `null` as the user identity. The socket stays open and connected, but `user:join` is not emitted until a non-null user is provided. This allows `NameEntryScreen` to show an accurate online count before the user has chosen a display name.

### Wire Contract (DTOs)

`chat/dtos/chat.dto.ts` defines all types that cross the network boundary. Keep in sync with `packages/server/src/chat/dtos/chat.dto.ts` manually until a shared types package is introduced across the monorepo.

| Type | Direction | Description |
|---|---|---|
| `Message` | Server → Client | A single chat message |
| `ChatUser` | Server → Client | Client-safe user projection |
| `UserColor` | Both | Allowed avatar colour palette values |
| `ServerToClientEvents` | Server → Client | Typed Socket.IO event map |
| `ClientToServerEvents` | Client → Server | Typed Socket.IO event map |

### Client-Side Models

`chat/models/chat.model.ts` holds types representing **client application state only** — never serialised over the wire. The `Room` interface aggregates `Message[]` and `ChatUser[]` from the DTO layer into a unified local snapshot.

---

## Theming

### ThemeContext

`contexts/ThemeContext.tsx` is the single source of truth for theming. Wrap the app in `<ThemeProvider>` (done in `app/_layout.tsx`) and consume via `useTheme()` anywhere below it.

```ts
const { colors, tokens, rgba, colorScheme, toggleColorScheme } = useTheme();

// Apply a theme colour directly
style={{ backgroundColor: rgba(colors.surface) }}

// Apply with alpha — no pre-generated opacity scale needed
style={{ backgroundColor: rgba(colors.primary, 0.1) }}
```

**Preference resolution order:**
1. User-set override (stored in `AsyncStorage` under key `'theme'`)
2. OS colour scheme (`useColorScheme()` from React Native)
3. Fallback: `'light'`

```ts
setColorScheme('dark')    // force dark mode; persists to AsyncStorage
setColorScheme('light')   // force light mode; persists to AsyncStorage
setColorScheme('system')  // remove stored key; OS preference applies on next launch
```

`AsyncStorage` is async — the provider renders the OS default immediately on mount, then applies the stored preference once the read resolves. This avoids blocking startup and prevents a flash of unstyled content.

### Colour Palette

Colours are stored as `ColorTuple` (`readonly [R, G, B]`) rather than hex strings. The `rgba()` helper composes arbitrary alpha values inline — no pre-generated opacity scale required.

| Role group | Tokens |
|---|---|
| Brand | `primary`, `secondary`, `tertiary` + `*Container` / `on*` / `on*Container` variants |
| Surface | 7 elevation levels: `surface`, `surfaceContainerLowest` → `surfaceContainerHighest` |
| Semantic | `success`, `warning`, `error`, `info` + `on*` and `*Container` / `on*Container` pairs |
| Borders | `outline` (interactive borders), `outlineVariant` (decorative dividers) |

`styles/theme/light.ts` is the base palette file and the source of the `ColorTuple` type. `styles/theme/dark.ts` imports `ColorTuple` from `light.ts` and provides dark-mode overrides — mirrors the CSS custom-property cascade strategy of the web package.

### Design Tokens

`styles/tokens.ts` provides all non-colour design decisions as concrete `dp`/`px` values for React Native's `StyleSheet` API.

| Token group | Contents |
|---|---|
| `tokens.typography` | 13 type scales: `displayLarge` → `labelSmall` (WCAG 2.2 line-heights) |
| `tokens.spacing` | 4dp-base scale, indices 0–96 |
| `tokens.motion.duration` | 16 named durations + semantic aliases (`fast`, `normal`, `slow`, …) |
| `tokens.motion.easing` | 10 cubic-bezier curves for `Easing.bezier()` |
| `tokens.shadows` | 6 Material elevation levels → iOS `shadow*` + Android `elevation` |
| `tokens.stateOpacity` | Pressed / focus / hover / disabled overlay opacities |
| `tokens.zIndex` | Named scale: `raised`, `sticky`, `modal`, `overlay`, … |

```ts
// Shadow tokens spread directly into StyleSheet objects
style={{ ...tokens.shadows.elevation2 }}
```

---

## Component Library

All UI primitives consume `useTheme()` for colours and are stateless about business logic. Dynamic colours are applied inline; static layout uses `StyleSheet.create()`.

### Avatar

`components/ui/data-display/Avatar.tsx` — compound component.

```ts
<Avatar.Root size="md" variant="subtle" color="info" name="Alex Chen">
  <Avatar.Fallback />                         {/* renders initials, or ◉ if no name */}
  <Avatar.Image src={url} alt="Alex Chen" />  {/* falls back to Fallback on error */}
</Avatar.Root>

<Avatar.Group overlap={8}>
  <Avatar.Root …><Avatar.Fallback /></Avatar.Root>
  <Avatar.Root …><Avatar.Fallback /></Avatar.Root>
</Avatar.Group>
```

| Prop | Type | Default |
|---|---|---|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` |
| `variant` | `'solid' \| 'subtle' \| 'outline'` | `'subtle'` |
| `color` | `'primary' \| 'secondary' \| 'tertiary' \| 'success' \| 'error' \| 'warning' \| 'info' \| 'neutral'` | `'primary'` |
| `name` | `string` | — |

### Status

`components/ui/data-display/Status.tsx` — compound component.

```ts
{/* Animated dot indicator */}
<Status.Indicator colorPalette="success" size="sm" pulse={isConnected} />

{/* Text label with coloured dot */}
<Status.Root colorPalette="warning" size="md">
  Reconnecting
</Status.Root>
```

The `pulse` prop drives a 1-second opacity loop (`1.0 → 0.4 → 1.0`) via React Native's `Animated` API — no Reanimated dependency required.

### IconButton

`components/ui/buttons/IconButton.tsx`

The `icon` prop is a render function `(color: string) => ReactNode` rather than a plain `ReactNode`. React Native has no CSS `currentColor` inheritance — the button must inject the correct icon colour based on variant state at render time.

```ts
<IconButton
  icon={(color) => <Ionicons name="send" size={16} color={color} />}
  variant="primary"
  size="sm"
  onPress={handleSend}
  disabled={!draft.trim()}
  aria-label="Send message"
/>
```

| Prop | Type | Default |
|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'tertiary' \| 'outline' \| 'text' \| 'danger'` | `'text'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `isLoading` | `boolean` | `false` |
| `hitSlop` | `number` | — |

### NameEntryScreen

`components/chat/NameEntryScreen.tsx` — gate screen rendered before identity is established.

```ts
<NameEntryScreen
  onNameSubmit={(name) => { /* persist to AsyncStorage + set user identity */ }}
  isConnected={isConnected}
  serverError={error}           // e.g. "name already taken"
  onClearServerError={clearError}
  onlineCount={users.length}    // live count from room:history before joining
/>
```

Client-side validation: name must be 2–32 characters. The component is stateless about storage — `app/index.tsx` owns the `AsyncStorage` write.

---

## Platform Notes

### Keyboard Handling

`app/index.tsx` implements a three-ref scroll-anchoring system instead of a single cached boolean. The problem with a single `isAtBottom` ref: `scrollTo(animated: false)` does not fire `onScroll` in React Native, leaving any cached offset incorrect for the next keyboard event.

| Ref | Updated by | Purpose |
|---|---|---|
| `scrollOffset` | `onScroll` + manual write after `scrollTo(animated: false)` | Current scroll position |
| `contentHeight` | `onContentSizeChange` | Total list height — updated when messages arrive |
| `layoutHeight` | `onLayout` | Visible viewport — updated when `KeyboardAvoidingView` resizes |

`computeIsAtBottom()` reads all three refs at call time — never a cached boolean — eliminating the class of stale-ref bugs entirely.

**On keyboard open:** if the user was at the bottom, a deferred `scrollToEnd` runs after the KAV layout pass commits. If mid-list, the offset shifts by `keyboardHeight` synchronously.

**On keyboard close:** if at the bottom, a deferred `scrollToEnd` chases the newly expanded viewport. If mid-list, the offset restores to the pre-keyboard snapshot.

### Android

- `KeyboardAvoidingView` `behavior` toggles between `'height'` (IME open) and `undefined` (IME closed) via `kavBehavior` state — cooperates with Android's window-resize pass without fighting the system inset
- Keyboard events: `keyboardDidShow` / `keyboardDidHide` (post-layout, exact final coordinates)
- `android.usesCleartextTraffic: true` in `app.json` permits `http://` connections in local development

### iOS

- `KeyboardAvoidingView` `behavior` is fixed to `'padding'`
- Keyboard events: `keyboardWillShow` / `keyboardWillHide` (pre-layout, for smoother co-animation)
- `SafeAreaView` with `edges={['top', 'left', 'right', 'bottom']}` handles the home indicator and Dynamic Island

---

## Transport & Connection Configuration

The socket client (`chat/lib/socket-client.ts`) uses **WebSocket-only** transport with the following options:

| Option | Value | Reason |
|---|---|---|
| `transports` | `['websocket']` | RN's `XMLHttpRequest` polyfill is incomplete; HTTP long-polling uses XHR and fails silently on Android. WebSocket-only bypasses the polyfill entirely. |
| `withCredentials` | `false` | RN's XHR polyfill behaves inconsistently when `withCredentials: true` (engine.io-client's default), causing request failures unrelated to auth. Auth is handled at socket middleware level via handshake payload, not cookies. |
| `reconnectionAttempts` | `Infinity` | Mobile connections drop constantly (tunnels, elevators, background). Never give up; the connection-state indicator surfaces degraded state to the user. |
| `timeout` | `20 000 ms` | Mobile cold-start latency and wake-from-background reconnects on slower networks need headroom beyond the default 10 s. |
| `reconnectionDelayMax` | `5 000 ms` | Exponential backoff capped at 5 s so the error state surfaces quickly rather than hiding behind slow silent retries. |

> **Do not set `addTrailingSlash: false`.** Socket.IO's default path is `/socket.io/` (with trailing slash). Stripping it produces `/socket.io`, which Express cannot match — manifests as `"xhr poll error"` or `"websocket error"` with no obvious root cause.

---

## Known Gotchas

**`EXPO_PUBLIC_SOCKET_URL` must use `https://`, not `wss://`**  
Socket.IO converts `https → wss` internally during the WebSocket upgrade handshake. Passing `wss://` directly is not supported by `socket.io-client`'s URL parser and causes silent connection failures in Expo Go on Android.

**React Compiler is experimental**  
`reactCompiler: true` is enabled in `app.json`. If you encounter unexpected rendering behaviour, disable it temporarily in `app.json` to isolate whether auto-memoisation is responsible before filing a bug.

**StrictMode double-mount in development**  
React 18 StrictMode double-invokes effects (mount → cleanup → mount). The socket stays connected through the cleanup, so the second mount never receives the `connect` event. The service handles this: if `socket.connected === true` when listeners are re-registered, `onConnect` is called immediately.

**`scrollTo(animated: false)` does not fire `onScroll`**  
React Native does not dispatch `onScroll` for non-animated programmatic scrolls. Every `scrollTo(animated: false)` call in `app/index.tsx` explicitly writes `scrollOffset.current` after the call to keep the ref accurate for the next keyboard event.

**Monorepo DTO sync is manual**  
`chat/dtos/chat.dto.ts` must be kept in sync with `packages/server/src/chat/dtos/chat.dto.ts` by hand. No shared types package exists yet. If you add or change an event shape, update both files and verify both packages compile.