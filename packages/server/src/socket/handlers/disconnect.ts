import type { Server as SocketServer, Socket } from 'socket.io';
import type { Message } from '../types.js';
import { generalRoom, pendingDisconnects, RECONNECT_GRACE_MS } from '../store.js';
import { toClientUsers } from '../utils.js';

export function handleDisconnect(io: SocketServer, socket: Socket) {
  return () => {
    const user = generalRoom.users.get(socket.id);
    if (user) {
      generalRoom.users.delete(socket.id);

      // Cancel any existing pending disconnect for this userId — multiple tabs sharing
      // the same URL/userId each produce their own socket, and rapid sequential closes
      // would leave a stale timer from the first close firing while the second is pending
      const existing = pendingDisconnects.get(user.userId);
      if (existing) clearTimeout(existing.timer);

      // Defer leave broadcast — browser refresh reconnects within the grace window,
      // so we only broadcast "left" if the user doesn't rejoin in time
      const timer = setTimeout(() => {
        pendingDisconnects.delete(user.userId);

        // Guard against multi-tab: generalRoom.users is keyed by socketId, so closing
        // one of N tabs deletes only that socket — the userId may still be present on
        // another socket. Only broadcast "left" when the userId is completely gone.
        const hasActiveSocket = Array.from(generalRoom.users.values()).some(
          u => u.userId === user.userId
        );
        if (hasActiveSocket) return;

        io.emit('room:users', toClientUsers(generalRoom.users));
        const leaveMsg: Message = {
          id: crypto.randomUUID(),
          userId: 'system',
          userName: 'System',
          userColor: 'neutral',
          text: `${user.name} left the room`,
          timestamp: new Date(),
        };
        generalRoom.messages.push(leaveMsg);
        io.emit('message:new', leaveMsg);
      }, RECONNECT_GRACE_MS);

      // Key by UUID — the reconnect handler in user:join looks up pendingDisconnects
      // by the same UUID from URL params, so this must match
      pendingDisconnects.set(user.userId, { timer, user });
    }
    console.log(`User disconnected: ${socket.id}`);
  };
}