/**
 * Socket Client — Singleton Factory
 *
 * Owns the single Socket.IO connection instance for the lifetime of the app.
 * Lives inside the chat domain (chat/lib/) because the socket connection is the
 * transport infrastructure of the chat feature — it is not a generic app utility.
 *
 * Centralising the singleton here (rather than a module-level variable in the hook)
 * makes the lifecycle explicit: hooks and services import the same instance without
 * depending on module evaluation order or HMR side-effects.
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
 * a socket actually mounts — avoids wasting a TCP handshake on pages that
 * never use the chat feature.
 */
export function getSocketClient(): AppSocket {
  if (!instance) {
    instance = io('http://localhost:3000', {
      // Credentials required for cross-origin cookie-based auth (CORS pre-flight)
      withCredentials: true,
      // autoConnect: true so the connection opens immediately on first call;
      // the hook controls join/leave lifecycle on top of this connection
      autoConnect: true,
    });
  }
  return instance;
}

/**
 * Disconnects and discards the singleton.
 *
 * Primarily useful in tests (reset between test cases) and for explicit
 * logout flows where the caller wants a clean-state reconnect on next mount.
 */
export function resetSocketClient(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}