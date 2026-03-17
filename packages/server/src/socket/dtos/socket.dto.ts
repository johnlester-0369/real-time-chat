// Server-side transport boundary types for the socket layer.
// Mirrors the web's dtos/chat.dto.ts pattern — types live at the wire boundary,
// not in domain logic. "dto" signals these are transport contracts, not internal models.
// Must stay in sync with the web's dtos/chat.dto.ts manually until a shared
// types package is introduced across the monorepo.

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: Date;
}

// socketId is the current transport connection — changes on every browser refresh/reconnect.
// userId is the stable client-generated UUID from URL params — persists across sessions.
// Separating them lets us correlate a returning client without relying on a mutable name.
export interface UserRecord {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  joinedAt: Date;
}

// Deduplicated, client-safe projection of UserRecord — strips socketId (internal transport detail)
// and remaps userId → id to match the web's ChatUser shape
export interface ClientUser {
  id: string;
  name: string;
  color: string;
  joinedAt: Date;
}

export interface Room {
  name: string;
  messages: Message[]; // not readonly — ring-buffer reassignment happens in RoomService.handleMessage
  users: Map<string, UserRecord>; // keyed by socketId for O(1) disconnect lookup
}

// Co-located with domain types so services can reference the shape without creating
// a circular dependency on the state module (avoids tight coupling to implementation)
export interface PendingDisconnectEntry {
  timer: ReturnType<typeof setTimeout>;
  user: UserRecord;
}

// Typed event maps consumed by Socket.IO's generic Server<C,S> and Socket<C,S>.
// C = events the server listens to (client → server)
// S = events the server emits (server → client)
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