/**
 * Socket Client — Singleton Factory
 *
 * Owns the single Socket.IO connection instance for the lifetime of the app.
 * Mirrors web's chat/lib/socket-client.ts with two mobile-specific adaptations:
 *   1. process.env.EXPO_PUBLIC_SOCKET_URL instead of import.meta.env.VITE_SOCKET_URL
 *   2. transports: ['websocket'] — React Native's fetch polyfill interferes with
 *      Socket.IO's XHR-based polling transport, causing silent connection failures on
 *      Android; websocket-only mode bypasses this and gives a stable persistent connection
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
 *     React Native's XHR polyfill is incomplete — HTTP long-polling silently
 *     breaks on Android. WebSocket-only bypasses the polyfill entirely.
 *
 *   upgrade: false
 *     Tells the engine not to attempt a transport upgrade after connecting.
 *     Without this, even with transports:['websocket'], the engine.io client
 *     emits an upgrade probe that can put the connection into a confused retry
 *     loop on Hermes / new architecture Android builds. Always pair this with
 *     transports:['websocket'] to lock the transport at the engine level.
 *
 *   addTrailingSlash: false
 *     Prevents socket.io-client from appending a trailing slash to the path,
 *     which causes double-slash URLs on some Expo/Metro bundler versions
 *     (e.g. "/socket.io//" instead of "/socket.io/").
 *
 *   reconnectionAttempts: Infinity
 *     Mobile connections drop regularly (tunnels, elevators, background).
 *     Never give up reconnecting; the UI's connection-state indicator is
 *     responsible for surfacing the degraded state to the user.
 *
 *   timeout: 20000
 *     Handshake timeout increased from 10 s — mobile networks (especially on
 *     first cold launch or a wake-from-background reconnect) can be significantly
 *     slower than desktop. 10 s was too aggressive and caused spurious timeouts
 *     on legitimate connections.
 */
export function getSocketClient(): AppSocket {
  if (!instance) {
    // Resolved at build time by Expo from .env.development / .env.production.
    // Throws at startup rather than silently connecting to undefined — fast-fail
    // surfaces misconfigured deployments immediately.
    const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
    if (!socketUrl) {
      throw new Error(
        'EXPO_PUBLIC_SOCKET_URL is not defined. Check your .env.development or .env.production file.',
      );
    }

    instance = io(socketUrl, {
      autoConnect: true,

      // ── Transport: WebSocket only ────────────────────────────────────────
      // React Native's XMLHttpRequest polyfill is incomplete — polling transport
      // uses XHR and breaks silently on Android. WebSocket-only ensures a stable
      // persistent connection across both iOS and Android. WebSocket connections
      // are also not subject to CORS restrictions (per the Fetch spec), bypassing
      // the browser same-origin policy entirely for native clients.
      transports: ['websocket'],

      // Prevent the engine.io upgrade probe even when transports is locked to
      // ['websocket']. Without this, Hermes / Android new arch builds can enter
      // a silent retry loop as the client repeatedly attempts and fails the
      // upgrade handshake. Setting upgrade:false eliminates the probe entirely.
      upgrade: false,

      // ── Path ────────────────────────────────────────────────────────────
      // Newer versions of socket.io-client append a trailing slash by default,
      // which produces malformed paths like "/socket.io//" on some Expo/Metro
      // bundler versions. Explicitly disabling it keeps the path clean.
      addTrailingSlash: false,

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