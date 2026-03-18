/**
 * Chat Domain — Public API Barrel
 *
 * This is the single import surface for all chat domain consumers.
 * app/index.tsx and any future screens import from '@/chat' rather than
 * reaching into chat/hooks/*, chat/dtos/*, or chat/services/* directly.
 *
 * Domain-based architecture boundary: everything inside chat/ is an
 * implementation detail. Only what is re-exported here is part of the
 * public contract of the chat domain.
 *
 * Mirrors web's src/chat/index.ts exactly — same barrel contract,
 * same domain boundary, different runtime environment.
 */

// Wire-contract types — consumed by app/index.tsx for message rendering and user identity
export type { Message, UserColor, ChatUser, ServerToClientEvents, ClientToServerEvents } from '@/chat/dtos/chat.dto';

// Hook — the primary React interface to the chat domain
export { useSocket } from '@/chat/hooks/useSocket';
export type { UseSocketUser, UseSocketReturn } from '@/chat/hooks/useSocket';