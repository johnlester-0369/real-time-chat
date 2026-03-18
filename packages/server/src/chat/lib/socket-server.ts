/**
 * Socket Server — Singleton Factory
 *
 * Owns the single SocketServer instance for the lifetime of the application.
 * Lives inside the chat domain (chat/lib/) because the socket server is the
 * transport infrastructure of the chat domain — it is not a generic app utility.
 *
 * Mirrors the web's chat/lib/socket-client.ts pattern — centralising the singleton
 * here makes the lifecycle explicit and allows services to resolve the typed server
 * without depending on module evaluation order or re-passing the instance via arguments.
 *
 * @module chat/lib/socket-server
 */

// .js extension required — nodenext moduleResolution emits .js references
import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@/chat/dtos/chat.dto.js';

// ============================================================================
// TYPES
// ============================================================================

export type AppSocketServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

// ============================================================================
// SINGLETON STATE
// ============================================================================

/**
 * Module-private singleton — callers must use initSocketServer() / getSocketServer() /
 * resetSocketServer(). Keeping it non-exported prevents consumers from accidentally
 * replacing the reference and creating a split-brain scenario with two active servers.
 */
let instance: AppSocketServer | null = null;

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Creates and stores the SocketServer singleton attached to the provided HTTP server.
 * Idempotent — returns the existing instance if already initialised, which guards
 * against double-init in test environments or accidental duplicate calls.
 *
 * CORS: This is a public chat server with no auth cookies or session credentials.
 * origin: '*' is correct here — `credentials: true` must NOT be combined with origin: '*'
 * (browsers reject that combination per the Fetch spec), so credentials is omitted entirely.
 * React Native native WebSocket connections bypass browser CORS enforcement regardless;
 * the wildcard covers Expo Go's web debugger and any future browser-based clients.
 * If auth is added later, switch to origin: [allowlist] + credentials: true + allowRequest.
 */
export function initSocketServer(httpServer: HttpServer): AppSocketServer {
  if (instance) return instance;

  instance = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      // Wildcard is safe without credentials: true — no auth cookies flow through this server.
      // Per the Fetch spec, Access-Control-Allow-Origin: * with credentials mode 'include'
      // is an error; omitting credentials keeps the wildcard valid for all browser clients.
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  return instance;
}

/**
 * Returns the existing SocketServer singleton.
 * Throws if initSocketServer() has not been called — callers in the chat domain layer
 * should only call this after server boot, never at module import time.
 */
export function getSocketServer(): AppSocketServer {
  if (!instance) {
    throw new Error('Socket server not initialised — call initSocketServer() first.');
  }
  return instance;
}

/**
 * Disconnects and discards the singleton.
 * Primarily useful in tests (reset between cases) and for graceful shutdown hooks
 * where a clean-state reinitialisation is required.
 */
export function resetSocketServer(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
