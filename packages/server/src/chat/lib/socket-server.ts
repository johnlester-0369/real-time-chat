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
// CORS HELPERS
// ============================================================================

/**
 * Builds the allowed-origin Set from the CORS_ORIGIN env var.
 * Supports comma-separated values so multiple origins (Render, Vercel, staging, etc.)
 * can be allowed without a code change — just update the Railway env var.
 * Falls back to localhost-only when the var is absent (local dev).
 */
function parseCorsOrigins(): Set<string> {
  const raw = process.env['CORS_ORIGIN'];
  if (!raw?.trim()) {
    // No env var — restrict to localhost variants so local dev still works
    return new Set(['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000']);
  }
  return new Set(raw.split(',').map((o) => o.trim()).filter(Boolean));
}

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

  // Build allowlist once at server startup — env vars don't change during process lifetime
  const allowedOrigins = parseCorsOrigins();

  instance = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      // Set lookup is O(1) and works for both localhost dev and production URLs injected via CORS_ORIGIN.
      // null origin (same-origin requests, Postman, curl) is always allowed — only browser cross-origin
      // requests carry a non-null Origin header that needs validation
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        callback(new Error(`Origin "${origin}" not allowed by CORS policy`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
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
