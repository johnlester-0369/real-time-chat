// Server-side wire-contract types for the chat domain.
// Only types that cross the client–server boundary live here: serialisable message
// shapes, the projected client-safe user view, and the typed Socket.IO event maps.
//
// Internal server models (UserRecord, Room, PendingDisconnectEntry) live in
// models/room.model.ts — they describe in-memory state, not API contracts.
//
// "chat" names this by business domain; previously "socket" named it by transport —
// the rename aligns with domain-based architecture where folders own a domain, not a mechanism.
//
// Must stay in sync with the web's chat/dtos/chat.dto.ts manually until a shared
// types package is introduced across the monorepo.

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: Date;
}

// Deduplicated, client-safe user projection sent over the wire — strips socketId
// (internal transport detail) and remaps userId → id to match the web's ChatUser shape
export interface ClientUser {
  id: string;
  name: string;
  color: string;
  joinedAt: Date;
}

// Typed event maps for Socket.IO's generic Server<C,S> and Socket<C,S>.
// C = events the server listens to (client → server); S = events the server emits (server → client)
export interface ServerToClientEvents {
  'room:history': (data: { room: string; messages: Message[]; users: ClientUser[] }) => void;
  'room:users': (users: ClientUser[]) => void;
  'message:new': (message: Message) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'user:join': (userData: { userId: string; name: string; color: string }) => void;
  'message:send': (data: { text: string }) => void;
}