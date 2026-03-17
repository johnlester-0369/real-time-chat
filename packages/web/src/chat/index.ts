/**
 * Chat Domain — Public API Barrel
 *
 * This is the single import surface for all chat domain consumers.
 * App.tsx and any future feature components import from '@/chat' rather than
 * reaching into chat/hooks/*, chat/dtos/*, or chat/services/* directly.
 *
 * Domain-based architecture boundary: everything inside chat/ is an
 * implementation detail. Only what is re-exported here is part of the
 * public contract of the chat domain.
 */

// Wire-contract types — consumed by App.tsx for message rendering and user identity
export type { Message, UserColor, ChatUser, ServerToClientEvents, ClientToServerEvents } from '@/chat/dtos/chat.dto';

// Hook — the primary React interface to the chat domain
export { useSocket } from '@/chat/hooks/useSocket';
export type { UseSocketUser, UseSocketReturn } from '@/chat/hooks/useSocket';