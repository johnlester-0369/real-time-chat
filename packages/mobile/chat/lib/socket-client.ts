/**
 * Socket Client — Singleton Factory
 *
 * Owns the single Socket.IO connection instance for the lifetime of the app.
 * Mirrors web's chat/lib/socket-client.ts with mobile-specific adaptations:
 *   1. process.env.EXPO_PUBLIC_SOCKET_URL instead of import.meta.env.VITE_SOCKET_URL
 *   2. transports: ['websocket'] — WebSocket-only mode bypasses React Native's
 *      incomplete XHR polyfill and gives a stable persistent connection on both
 *      iOS and Android.
 *
 *      WHY websocket-only works (after the CORS + path fixes):
 *        a) The root cause of earlier failures was NOT the transport choice — it was
 *           addTrailingSlash:false stripping /socket.io/ → /socket.io (404), and
 *           withCredentials:true causing XHR inconsistencies in Expo Go's network stack.
 *        b) With those fixed, WebSocket-only is the leaner, lower-latency option —
 *           no HTTP polling round-trip before the upgrade, one persistent TCP connection.
 *        c) WebSocket connections bypass browser CORS restrictions entirely (per the
 *           Fetch spec), which simplifies the server-side origin handling for native clients.
 *
 *   3. addTrailingSlash must NOT be set to false — Socket.IO's default path is
 *      /socket.io/ (with trailing slash). Stripping it produces /socket.io (no slash)
 *      which Express cannot match, returning a 404 that manifests as "xhr poll error"
 *      or "websocket error". Leave addTrailingSlash at its default (true).
 *
 * @module chat/lib/socket-client
 */

import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/chat/dtos/chat.dto';

// ============================================================================
// TYPES
// ============================================================================

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ============================================================================
// SINGLETON STATE
// ============================================================================

/**
 * Module-private singleton — callers must use getSocketClient() / resetSocketClient().
 * Keeping it non-exported prevents consumers from accidentally replacing the reference
 * and creating a split-brain scenario where two parts of the app hold different sockets.
 */
let instance: AppSocket | null = null;

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Returns the existing Socket.IO connection or lazily creates one.
 *
 * Lazy init means no connection is opened until the first component that needs
 * a socket actually mounts — avoids wasting a TCP handshake on screens that
 * don't need the chat domain.
 *
 * Key React Native / Expo options explained:
 *
 *   transports: ['websocket']
 *     WebSocket-only mode. React Native's XMLHttpRequest polyfill is incomplete —
 *     HTTP long-polling uses XHR under the hood and can break silently on Android.
 *     WebSocket-only bypasses the polyfill entirely and gives a stable persistent
 *     connection on both iOS and Android.
 *     NOTE: EXPO_PUBLIC_SOCKET_URL must use https:// (not wss://).
 *     Socket.IO automatically converts https → wss for the WebSocket handshake.
 *     Using wss:// directly is not supported by the socket.io-client URL parser
 *     and causes connection failures in Expo Go.
 *
 *   withCredentials: false
 *     Disables the implicit credentials flag on XHR requests. React Native's XHR
 *     polyfill behaves inconsistently when withCredentials is true (engine.io-client's
 *     default), causing request failures unrelated to CORS or auth headers.
 *     Safe to disable here because auth is handled at the socket middleware level
 *     (JWT in the handshake auth payload), not via cookies or browser credentials.
 *
 *   reconnectionAttempts: Infinity
 *     Mobile connections drop regularly (tunnels, elevators, background).
 *     Never give up reconnecting; the UI's connection-state indicator is
 *     responsible for surfacing the degraded state to the user.
 *
 *   timeout: 20000
 *     Handshake timeout increased from the original 10 s — mobile cold-start
 *     latency and wake-from-background reconnects on slower networks need the
 *     extra headroom to avoid spurious timeout failures.
 *
 * Options intentionally omitted / left at defaults:
 *
 *   addTrailingSlash  — left at default (true). Setting it to false strips the
 *     trailing slash from /socket.io/ → /socket.io, which Express cannot match
 *     and returns a 404. Root cause of the "xhr poll error / Cannot GET /socket.io"
 *     failure seen during debugging. Do not set this option.
 *
 *   upgrade  — left at default (true). No-op when transports is locked to
 *     ['websocket'] since there is no lower transport to upgrade from.
 */
export function getSocketClient(): AppSocket {
  if (!instance) {
    // Resolved at build time by Expo from .env.development / .env.production.
    // Must be https:// — NOT wss://. Socket.IO converts https → wss internally
    // during the WebSocket handshake. Using wss:// directly is not supported by
    // the socket.io-client URL parser and causes connection failures in Expo Go.
    // Throws at startup rather than silently connecting to undefined — fast-fail
    // surfaces misconfigured deployments immediately.
    const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
    if (!socketUrl) {
      throw new Error(
        'EXPO_PUBLIC_SOCKET_URL is not defined. Check your .env.development or .env.production file.',
      );
    }

    if (!socketUrl.startsWith('https://') && !socketUrl.startsWith('http://')) {
      // Catch the common mistake of setting wss:// or ws:// directly.
      // Socket.IO needs the HTTP(S) URL — it derives the WebSocket URL internally.
      // Using wss:// directly causes connection failures in Expo Go on Android.
      console.warn(
        '[socket-client] WARNING: EXPO_PUBLIC_SOCKET_URL should start with https:// or http://, ' +
          `not "${socketUrl.split('://')[0]}://". Raw WebSocket URLs cause connection failures in Expo Go.`,
      );
    }

    instance = io(socketUrl, {
      autoConnect: true,

      // ── Transport ────────────────────────────────────────────────────────
      // WebSocket-only: bypasses React Native's incomplete XHR polyfill and
      // gives a stable persistent connection on both iOS and Android.
      // WebSocket connections are also not subject to CORS restrictions (per the
      // Fetch spec), bypassing the browser same-origin policy for native clients.
      transports: ['websocket'],

      // ── Credentials ─────────────────────────────────────────────────────
      // Disable implicit XHR credentials. React Native's XHR polyfill is not
      // spec-compliant when withCredentials is true, causing request failures
      // unrelated to auth. Auth tokens are passed via the handshake auth payload.
      withCredentials: false,

      // ── Reconnection config ──────────────────────────────────────────────
      // Exponential backoff capped at 5 s so the UI shows the error state
      // quickly rather than hiding behind slow silent retries. Infinite attempts
      // because mobile connections drop constantly (background, tunnels, etc.).
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,

      // ── Timeouts ────────────────────────────────────────────────────────
      // Increased from 10 s to 20 s — mobile cold-start latency and wake-from-
      // background reconnects on slow networks need the extra headroom.
      timeout: 20000,
    });

    // Surface connection errors to the console so developers can see WHY the
    // connection is failing (DNS, TLS, CORS, server crash, wrong URL, etc.)
    // These are engine.io-level errors that fire before the socket-level error event.
    instance.on('connect_error', (err) => {
      console.error('[socket-client] connect_error:', err.message);
      console.error('[socket-client] error detail:', err);
    });

    // Log disconnections with the reason so you can distinguish between:
    //   'io server disconnect'  — server explicitly kicked the client (auth failure, etc.)
    //   'transport close'       — network dropped (background, tunnel, etc.)
    //   'ping timeout'          — server didn't receive a heartbeat in time
    instance.on('disconnect', (reason) => {
      console.warn('[socket-client] disconnected:', reason);
    });
  }

  return instance;
}

/**
 * Disconnects and discards the singleton.
 *
 * Primarily useful in tests (reset between test cases) and explicit logout flows
 * where the caller wants a clean-state reconnect on next mount.
 */
export function resetSocketClient(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}