// Client-side domain models — types that represent client application state
// and are never sent over the wire as API payloads.
//
// Wire-contract types (Message, ChatUser, UserColor, event maps) live in
// chat/dtos/chat.dto.ts. Types that aggregate or hold client-local state live here.

import type { ChatUser, Message } from '@/chat/dtos/chat.dto';

// Client-side room state container — aggregates the wire types received from the server
// into a unified view. Not serialised or emitted; used only by components and hooks
// that need to hold the full room snapshot locally.
export interface Room {
  name: string;
  users: ChatUser[];
  messages: Message[];
}