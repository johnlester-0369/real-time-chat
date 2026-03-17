// Central domain type definitions for the socket layer.
// Zero project-local imports — this is the leaf node all other socket modules depend on,
// so keeping it import-free eliminates any risk of circular dependencies.

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

export interface Room {
  name: string;
  messages: Message[];
  users: Map<string, UserRecord>; // keyed by socketId for O(1) disconnect lookup
}

// Co-located with domain types rather than store.ts so handlers can reference the shape
// without importing from the store module (avoids tight coupling to state implementation).
export interface PendingDisconnectEntry {
  timer: ReturnType<typeof setTimeout>;
  user: UserRecord;
}