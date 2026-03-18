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
 * Supports comma-separated values so multiple origins (Railway, Vercel, staging)
 * can be permitted without a code change — just update the platform env var.
 * Returns an empty Set when the var is absent so the origin callback falls back
 * to allowing all origins (safe for local dev; production always sets CORS_ORIGIN).
 */
function parseCorsOrigins(): Set<string> {
  const origins = new Set<string>();

  const raw = process.env['CORS_ORIGIN'];
  if (raw?.trim()) {
    raw.split(',').map((o) => o.trim()).filter(Boolean).forEach((o) => origins.add(o));
  }

  // React Native WebSocket (both iOS and Android) echoes the server's own deployed URL
  // as the Origin header on every connection attempt. When CORS_ORIGIN restricts browser
  // origins, native clients are blocked unless the server URL is also in the allowlist.
  // Fix: set SERVER_URL=https://your-server-url.com in the server .env AND the
  // deployment platform's environment variable settings (Railway, Render, etc.).
  const serverUrl = process.env['SERVER_URL']?.trim().replace(/\/$/, '');
  if (serverUrl) origins.add(serverUrl);

  return origins;
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
 * CORS STRATEGY — three client types, one callback handles all:
 *
 *   1. Native mobile (React Native / Expo Go with transports:['websocket'])
 *      → Sends no Origin header at the native TCP level.
 *      → The `!origin` branch always allows these through without an allowlist lookup.
 *
 *   2. Browser web clients (Vite dev server, production web app)
 *      → Send an Origin header on every HTTP polling request.
 *      → Checked against the CORS_ORIGIN allowlist in production.
 *      → In local dev (no CORS_ORIGIN env var) all origins are allowed.
 *
 *   3. credentials: true is required for browser compatibility even without cookies —
 *      some browser environments send credentials mode 'include' implicitly. Using
 *      origin: '*' with credentials: true is forbidden by the Fetch spec and causes
 *      browsers to block the response. The dynamic callback + credentials: true
 *      is the correct pattern: the callback echoes the specific origin back so the
 *      browser sees Access-Control-Allow-Origin: <exact-origin>, not the wildcard.
 */
export function initSocketServer(httpServer: HttpServer): AppSocketServer {
  if (instance) return instance;

  // Build allowlist once at server startup — env vars don't change during process lifetime
  const allowedOrigins = parseCorsOrigins();

  instance = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // React Native WebSocket Origin handling — two distinct cases by platform:
        //   iOS native WebSocket: sends no Origin header at all → !origin catches this
        //   Android native WebSocket: sends the string literal "null" as Origin (not JS null,
        //   not absent — the actual four-character string). Both cases bypass browser CORS
        //   enforcement entirely, so both should be allowed unconditionally regardless of
        //   the CORS_ORIGIN allowlist.
        if (!origin || origin === 'null') return callback(null, true);

        // Local dev: no CORS_ORIGIN env var set → allow all origins so any dev tool,
        // browser, or Expo web target connects without configuration
        if (allowedOrigins.size === 0) return callback(null, true);

        // Production: origin must be in the CORS_ORIGIN allowlist set via Railway env var.
        // Set.has() is O(1); the allowlist is built once at startup, not per-request.
        if (allowedOrigins.has(origin)) return callback(null, true);

        callback(new Error(`Origin "${origin}" is not permitted by CORS policy`));
      },
      methods: ['GET', 'POST'],
      // credentials: true is required for browser clients — without it, browsers that
      // send credentials mode 'include' (implicit in some environments) will reject the
      // response even when the origin matches. Must NOT be combined with origin: '*'
      // (Fetch spec violation); the dynamic callback above ensures we never echo back '*'.
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
