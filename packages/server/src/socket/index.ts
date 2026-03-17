import type { Server as HttpServer } from 'http';
// Socket is used only as a type annotation in the connection callback — inline type modifier
// keeps the import from being emitted as a value import by verbatimModuleSyntax
import { Server as SocketServer, type Socket } from 'socket.io';
import { generalRoom } from './store.js';
import { toClientUsers } from './utils.js';
import { handleUserJoin } from './handlers/join.js';
import { handleMessageSend } from './handlers/message.js';
import { handleDisconnect } from './handlers/disconnect.js';

// Public API surface mirrors the original socket.ts export — server.ts requires no
// signature change, only the import path changes to ./socket/index.js
export default function setupSocketServer(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      // Allow any localhost origin for development flexibility (client may use port 5173, 5174, etc.)
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send history immediately on connect so the client can show online count and
    // seed messages before the user has even typed their name
    socket.emit('room:history', {
      room: 'general',
      messages: generalRoom.messages,
      users: toClientUsers(generalRoom.users),
    });

    // Each factory call captures (io, socket) in a closure — Socket.IO receives a plain
    // () => void handler with no extra arguments, keeping the binding declarative
    socket.on('user:join', handleUserJoin(io, socket));
    socket.on('message:send', handleMessageSend(io, socket));
    socket.on('disconnect', handleDisconnect(io, socket));
  });

  return io;
}