// .js extension required — nodenext moduleResolution resolves to .ts at compile time
// but the emitted JS and Node's ESM loader both need the .js reference
import type { Server as HttpServer } from 'http';
import { initSocketServer } from '@/socket/lib/socket-server.js';
import { roomService } from '@/socket/services/room.service.js';

// Public API surface mirrors the original export — server.ts requires no signature change.
// Internal implementation now delegates entirely to lib/ (SocketServer lifecycle + CORS)
// and services/ (room state + event logic), making this file pure wiring.
export default function setupSocketServer(httpServer: HttpServer) {
  const io = initSocketServer(httpServer);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send history immediately on connect so the client can show online count and
    // seed messages before the user has even typed their name
    socket.emit('room:history', roomService.getHistory());

    // Arrow-function wrappers forward the typed event payload to the service.
    // handleDisconnect uses the factory pattern — returns () => void directly —
    // so it can be passed without a wrapper, matching Socket.IO's expected signature.
    socket.on('user:join', (userData) => roomService.handleJoin(io, socket, userData));
    socket.on('message:send', (data) => roomService.handleMessage(io, socket, data));
    socket.on('disconnect', roomService.handleDisconnect(io, socket));
  });

  return io;
}