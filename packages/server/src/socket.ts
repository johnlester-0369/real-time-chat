import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: Date;
}

interface Room {
  name: string;
  messages: Message[];
  users: Map<string, { id: string; name: string; color: string }>;
}

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

// Pre-populate at module init so seeds survive user churn — conditional injection
// caused duplicates whenever the room emptied and a new connection arrived
const generalRoom: Room = {
  name: 'general',
  messages: [...SEED_MESSAGES],
  users: new Map(),
};

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

    socket.emit('room:history', {
      room: 'general',
      messages: generalRoom.messages,
      users: Array.from(generalRoom.users.values()),
    });
    socket.on('user:join', (userData: { name: string; color: string }) => {
      // Idempotency check: prevent duplicate join messages if client accidentally re-emits
      // This stops infinite loops caused by client-side state re-renders
      const existingUser = generalRoom.users.get(socket.id);
      if (existingUser) {
        // User already joined — just update their info without broadcasting "joined" message
        generalRoom.users.set(socket.id, {
          id: socket.id,
          name: userData.name,
          color: userData.color,
        });
        io.emit('room:users', Array.from(generalRoom.users.values()));
        return;
      }

      generalRoom.users.set(socket.id, {
        id: socket.id,
        name: userData.name,
        color: userData.color,
      });

      io.emit('room:users', Array.from(generalRoom.users.values()));

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
    });

    socket.on('message:send', (data: { text: string }) => {
      const user = generalRoom.users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'You must join first' });
        return;
      }

      const message: Message = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name,
        userColor: user.color,
        text: data.text,
        timestamp: new Date(),
      };

      generalRoom.messages.push(message);

      if (generalRoom.messages.length > 100) {
        generalRoom.messages = generalRoom.messages.slice(-100);
      }

      io.emit('message:new', message);
    });

    socket.on('disconnect', () => {
      const user = generalRoom.users.get(socket.id);
      if (user) {
        generalRoom.users.delete(socket.id);

        io.emit('room:users', Array.from(generalRoom.users.values()));

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
      }
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
}
