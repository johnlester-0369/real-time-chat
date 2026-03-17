import type { Message, Room, PendingDisconnectEntry } from './types.js';

// Full Message type avoids the Omit<> + UUID spread pattern at injection time
const SEED_MESSAGES: Message[] = [
  {
    id: crypto.randomUUID(),
    userId: 'system',
    userName: 'System',
    userColor: 'neutral',
    text: 'Welcome to the chat! 👋',
    timestamp: new Date(),
  },
  {
    id: crypto.randomUUID(),
    userId: 'system',
    userName: 'System',
    userColor: 'neutral',
    text: 'Messages are stored in memory and will disappear on server restart.',
    timestamp: new Date(),
  },
];

// Pre-populated at module init so seeds survive user churn — conditional injection
// caused duplicates whenever the room emptied and a new connection arrived.
// Exported as a mutable reference so handlers can push/replace without indirection;
// a future persistence layer would swap this module without touching any handler.
export const generalRoom: Room = {
  name: 'general',
  messages: [...SEED_MESSAGES],
  users: new Map(),
};

// Cross-session user store keyed by client UUID — preserves joinedAt and reserves the name
// for returning users whose grace period has already expired (full page close and reopen)
export const userRegistry = new Map<string, { name: string; color: string; joinedAt: Date }>();

// Grace period prevents "left/joined" spam when browser refresh causes rapid disconnect-reconnect
export const RECONNECT_GRACE_MS = 5_000;

// Keyed by client UUID — UUID is immutable and collision-free; name-keyed was fragile
// under name changes and had O(n) identity lookup
export const pendingDisconnects = new Map<string, PendingDisconnectEntry>();