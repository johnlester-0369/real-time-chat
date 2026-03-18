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
      // websocket-only: React Native's XMLHttpRequest polyfill is incomplete — polling
      // transport uses XHR and breaks silently on Android. WebSocket-only ensures a stable
      // persistent connection across both iOS and Android. WebSocket connections are also
      // not subject to CORS restrictions (per the Fetch spec), bypassing the browser
      // same-origin policy entirely for native clients.
      transports: ['websocket'],
      // Reconnection config: exponential backoff capped at 5s so the UI shows
      // the error state quickly rather than hiding behind infinite silent retries
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Explicit handshake timeout — default is 20s which is too long to surface errors
      timeout: 10000,
    });

    // Surface connection errors to the console so developers can see WHY the
    // connection is failing (DNS, TLS, CORS, server crash, wrong URL, etc.)
    // These are engine.io-level errors that fire before the socket-level error event
    instance.on('connect_error', (err) => {
      console.error('[socket-client] Connection error:', err.message, err);
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
