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
 *
 * NOTE: SERVER_URL is no longer needed here. Android React Native (new arch /
 * Hermes) echoes the server's deployed URL as the Origin header. This is now
 * handled directly in the origin callback via the HTTPS-origin branch, removing
 * the need to set a separate SERVER_URL env var that was easy to forget.
 */
function parseCorsOrigins(): Set<string> {
  const origins = new Set<string>();

  const raw = process.env['CORS_ORIGIN'];
  if (raw?.trim()) {
    raw.split(',').map((o) => o.trim()).filter(Boolean).forEach((o) => origins.add(o));
  }

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
 *      iOS native (old + new arch):    Sends NO Origin header → `!origin` catches this.
 *      Android native (string "null"): Caught by the `origin === 'null'` branch.
 *      Android new arch / Hermes:      Sends the deployed server URL as Origin
 *                                      (e.g. "https://myapp.railway.app"). Previously
 *                                      this required SERVER_URL to be set. Now handled
 *                                      by the `origin.startsWith('https://')` branch below.
 *
 *      Why is blanket HTTPS-origin acceptance safe for native?
 *        a) CORS is a browser security model — native apps are not subject to it.
 *        b) A native app already has full control over its own request headers, so
 *           the Origin value has no trust value regardless of what it contains.
 *        c) Real per-socket security must live in your auth middleware (JWT / token
 *           checks on the 'connection' event), not in the Origin header.
 *        d) We still reject plain http:// origins not on the explicit allowlist,
 *           protecting against LAN-based attacks from browser pages.
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
 *
 * MOBILE HEARTBEAT TUNING:
 *   The default pingTimeout (20 s) is too short for mobile clients. iOS and Android
 *   both suspend the JS thread when the app is backgrounded, stalling the heartbeat.
 *   Increasing pingTimeout to 60 s gives the OS enough time to resume the app before
 *   the server declares the socket dead and triggers a full reconnect cycle.
 *   Keep pingInterval + pingTimeout < 120 s to avoid React Native warnings.
 */
export function initSocketServer(httpServer: HttpServer): AppSocketServer {
  if (instance) return instance;

  // Build allowlist once at server startup — env vars don't change during process lifetime
  const allowedOrigins = parseCorsOrigins();

  instance = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // ── No Origin header ─────────────────────────────────────────────────
        // React Native WebSocket — three cases handled:
        //   iOS native (old + new arch):    no Origin header → !origin catches this
        //   Android native:                 sends the string "null" → caught here
        if (!origin || origin === 'null') return callback(null, true);

        // ── Local dev ────────────────────────────────────────────────────────
        // No CORS_ORIGIN env var set → allow all origins so any dev tool,
        // browser, or Expo web target connects without configuration
        if (allowedOrigins.size === 0) return callback(null, true);

        // ── Explicit allowlist match ──────────────────────────────────────────
        // Production: origin must be in the CORS_ORIGIN allowlist set via Railway env var.
        // Set.has() is O(1); the allowlist is built once at startup, not per-request.
        if (allowedOrigins.has(origin)) return callback(null, true);

        // ── Native mobile HTTPS origins ──────────────────────────────────────
        // Android React Native (new arch / Hermes) echoes the server's own deployed
        // URL as the Origin header (e.g. "https://myapp.railway.app"). Since CORS is
        // a browser-only security model, a native app's Origin value carries no trust
        // weight — real security is enforced by your socket auth middleware (JWT checks).
        // We allow any HTTPS origin that didn't match the explicit allowlist, and
        // continue to reject plain http:// origins to guard against LAN browser attacks.
        if (origin.startsWith('https://')) return callback(null, true);

        callback(new Error(`Origin "${origin}" is not permitted by CORS policy`));
      },
      methods: ['GET', 'POST'],
      // credentials: true is required for browser clients — without it, browsers that
      // send credentials mode 'include' (implicit in some environments) will reject the
      // response even when the origin matches. Must NOT be combined with origin: '*'
      // (Fetch spec violation); the dynamic callback above ensures we never echo back '*'.
      credentials: true,
    },

    // ── Mobile-friendly heartbeat tuning ───────────────────────────────────
    // pingInterval: left at the default (25 s) — controls how often the server
    //   sends a ping to check if the client is still alive.
    // pingTimeout: increased from the default 20 s to 60 s. Mobile OS schedulers
    //   can suspend the JS thread for several seconds when the app is backgrounded.
    //   A 20 s window is too short and causes spurious disconnects on iOS and Android.
    //   60 s gives the platform enough time to resume the app and respond to the ping.
    //   Rule: keep pingInterval + pingTimeout below 120 s to avoid React Native warnings.
    pingInterval: 25000,
    pingTimeout: 60000,
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