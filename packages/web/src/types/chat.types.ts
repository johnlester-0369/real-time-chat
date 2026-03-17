// Mirrors server-side Message interface — must stay in sync manually until
// we set up a shared types package
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

export interface Room {
  name: string;
  users: ChatUser[];
  messages: Message[];
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
