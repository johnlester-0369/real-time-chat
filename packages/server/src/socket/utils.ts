import type { UserRecord } from './types.js';

// Deduplicate by userId before sending to clients — generalRoom.users is keyed by socketId,
// so a user with N open tabs has N entries in the map. The client counts users.length for the
// "X online" display, so emitting all socket entries inflates the count. Last-write-wins on
// duplicate userId is fine because all tabs share the same name/color/joinedAt.
export function toClientUsers(users: Map<string, UserRecord>) {
  const unique = new Map<string, { id: string; name: string; color: string; joinedAt: Date }>();
  for (const u of users.values()) {
    unique.set(u.userId, {
      id: u.userId,
      name: u.name,
      color: u.color,
      joinedAt: u.joinedAt,
    });
  }
  return Array.from(unique.values());
}