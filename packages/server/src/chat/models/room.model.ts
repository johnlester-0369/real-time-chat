// Internal server-side domain models — types that describe in-memory state and
// never cross the client–server boundary. Kept separate from dtos/chat.dto.ts
// because DTOs should only contain wire-contract shapes; mixing in server-internal
// structures (socketId, Map, setTimeout timer) would mislead consumers who import
// DTOs expecting serialisable API contracts.

// .js extension required — nodenext moduleResolution emits .js references
import type { Message } from '@/chat/dtos/chat.dto.js';

// socketId: current transport connection — changes on every browser refresh/reconnect.
// userId: stable client-generated UUID from URL params — persists across sessions.
// Separating them lets us correlate a returning client without relying on a mutable name.
export interface UserRecord {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  joinedAt: Date;
}

// In-memory room state — Map<socketId, UserRecord> for O(1) disconnect lookup.
// messages is not readonly because ring-buffer reassignment happens in RoomService.handleMessage.
// This type is an internal server model, not a serialisable response shape.
export interface Room {
  name: string;
  messages: Message[];
  users: Map<string, UserRecord>;
}

// Grace-period bookkeeping for the reconnect window — never leaves the server process.
// Holds a setTimeout handle alongside the user snapshot so the disconnect handler
// can cancel the timer and restore the user without re-fetching from the room map.
export interface PendingDisconnectEntry {
  timer: ReturnType<typeof setTimeout>;
  user: UserRecord;
}