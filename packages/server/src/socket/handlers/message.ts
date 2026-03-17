import type { Server as SocketServer, Socket } from 'socket.io';
import type { Message } from '../types.js';
import { generalRoom } from '../store.js';

export function handleMessageSend(io: SocketServer, socket: Socket) {
  return (data: { text: string }) => {
    const user = generalRoom.users.get(socket.id);
    if (!user) {
      socket.emit('error', { message: 'You must join first' });
      return;
    }

    const message: Message = {
      id: crypto.randomUUID(),
      // Client UUID as message author — the client's isMessageFromMe check compares against
      // this field, so it must be the stable UUID, not socket.id which changes on reconnect
      userId: user.userId,
      userName: user.name,
      userColor: user.color,
      text: data.text,
      timestamp: new Date(),
    };

    generalRoom.messages.push(message);

    // Ring-buffer cap: slice(-100) discards the oldest messages to prevent unbounded
    // memory growth while preserving recent history for late-joining clients
    if (generalRoom.messages.length > 100) {
      generalRoom.messages = generalRoom.messages.slice(-100);
    }

    io.emit('message:new', message);
  };
}