/**
 * Socket Server — Singleton Factory
 *
 * Owns the single SocketServer instance for the lifetime of the application.
 * Mirrors the web's lib/socket-client.ts pattern — centralising the singleton here
 * makes the lifecycle explicit and allows services/index.ts to resolve the typed server
 * without depending on module evaluation order or re-passing the instance via arguments.
 *
 * @module socket/lib/socket-server
 */

// .js extension required — nodenext moduleResolution emits .js references
import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@/socket/dtos/socket.dto.js';

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
 * CORS is configured here rather than in index.ts because it is infrastructure-level
 * policy, not connection routing logic — separation of concerns.
 */
export function initSocketServer(httpServer: HttpServer): AppSocketServer {
  if (instance) return instance;

  instance = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      // Allow any localhost origin for development flexibility — the Vite dev server
      // may use port 5173, 5174, etc. depending on which ports are free
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  return instance;
}

/**
 * Returns the existing SocketServer singleton.
 * Throws if initSocketServer() has not been called — callers in the socket layer
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
