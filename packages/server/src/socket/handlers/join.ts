import type { Server as SocketServer, Socket } from 'socket.io';
import type { Message, UserRecord } from '../types.js';
import { generalRoom, userRegistry, pendingDisconnects } from '../store.js';
import { toClientUsers } from '../utils.js';

// Factory pattern — captures io and socket in a closure so the returned function
// matches the exact signature Socket.IO expects for event listeners, keeping the
// binding in index.ts as a one-liner: socket.on('user:join', handleUserJoin(io, socket))
export function handleUserJoin(io: SocketServer, socket: Socket) {
  return (userData: { userId: string; name: string; color: string }) => {
    // Idempotency check: socket already registered (duplicate emit from client side)
    const existingUser = generalRoom.users.get(socket.id);
    if (existingUser) {
      // Preserve original joinedAt — only update mutable display fields on re-emit
      generalRoom.users.set(socket.id, {
        ...existingUser,
        name: userData.name,
        color: userData.color,
      });
      io.emit('room:users', toClientUsers(generalRoom.users));
      return;
    }

    // Reconnect within grace window — cancel pending leave broadcast and silently restore.
    // UUID key means browser refresh (new socket.id, same UUID from URL) is correctly
    // identified as the same user, avoiding a spurious "left / joined" notification pair.
    const pending = pendingDisconnects.get(userData.userId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingDisconnects.delete(userData.userId);
      generalRoom.users.set(socket.id, { ...pending.user, socketId: socket.id });
      io.emit('room:users', toClientUsers(generalRoom.users));
      return;
    }

    // Name uniqueness: a name is "taken" only if a *different* UUID currently holds it.
    // A known UUID reclaiming its own name (e.g. after grace expiry) is always allowed —
    // the name was reserved for them in userRegistry.
    const currentHolder = Array.from(generalRoom.users.values()).find(
      u => u.name.toLowerCase() === userData.name.toLowerCase()
    );
    const nameTaken = currentHolder !== undefined && currentHolder.userId !== userData.userId;
    if (nameTaken) {
      socket.emit('error', { message: `"${userData.name}" is already taken. Please choose a different name.` });
      return;
    }

    // Preserve original joinedAt for returning users whose grace period expired —
    // they were seen before so we don't reset their tenure in the room
    const registered = userRegistry.get(userData.userId);
    const joinedAt = registered?.joinedAt ?? new Date();
    const isNewUser = registered === undefined;

    const newUser: UserRecord = {
      socketId: socket.id,
      userId: userData.userId,
      name: userData.name,
      color: userData.color,
      joinedAt,
    };

    userRegistry.set(userData.userId, { name: userData.name, color: userData.color, joinedAt });
    generalRoom.users.set(socket.id, newUser);
    io.emit('room:users', toClientUsers(generalRoom.users));

    // Only broadcast join message for genuinely new users — returning users after
    // grace expiry reconnect silently to avoid spamming the room with known names
    if (isNewUser) {
      const joinMsg: Message = {
        id: crypto.randomUUID(),
        userId: 'system',
        userName: 'System',
        userColor: 'neutral',
        text: `${userData.name} joined the room`,
        timestamp: new Date(),
      };
      generalRoom.messages.push(joinMsg);
      io.emit('message:new', joinMsg);
    }
  };
}