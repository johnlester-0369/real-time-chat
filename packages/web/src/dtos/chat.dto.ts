// Client–server wire-contract types: only types that cross the network boundary live here.
// Message shapes, the client-safe user projection, and the typed Socket.IO event maps.
// "dto" signals these are transport contracts, not application-state models.
//
// Client-side state aggregates (e.g. Room) live in models/chat.model.ts.
// Must stay in sync with server-side dtos/socket.dto.ts manually until a shared
// types package is introduced across the monorepo.

// Mirrors server-side Message interface
export interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor: string;  // primary, secondary, tertiary, success, warning, info, neutral
  text: string;
  timestamp: Date;
}

// Subset of AvatarColor — excludes 'neutral' and 'error' to keep chat colors friendly
export type UserColor = 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'info' | 'neutral';

export interface ChatUser {
  id: string; // stable client-generated UUID — persisted in URL params, not socket.id
  name: string;
  color: UserColor;
  joinedAt: Date;
}

// WebSocket event payload types
export interface ServerToClientEvents {
  'room:history': (data: { room: string; messages: Message[]; users: ChatUser[] }) => void;
  'room:users': (users: ChatUser[]) => void;
  'message:new': (message: Message) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'user:join': (userData: { userId: string; name: string; color: UserColor }) => void;
  'message:send': (data: { text: string }) => void;
}
