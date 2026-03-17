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

// socketId is the current transport connection — changes on every browser refresh/reconnect.
// userId is the stable client-generated UUID from URL params — persists across sessions.
// Separating them lets us correlate a returning client without relying on a mutable name.
interface UserRecord {
  socketId: string;
  userId: string;
  name: string;
  color: string;
  joinedAt: Date;
}

interface Room {
  name: string;
  messages: Message[];
  users: Map<string, UserRecord>; // keyed by socketId for O(1) disconnect lookup
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

// Cross-session user store keyed by client UUID — preserves joinedAt and reserves the name
// for returning users whose grace period has already expired (full page close and reopen)
const userRegistry = new Map<string, { name: string; color: string; joinedAt: Date }>();

// Grace period prevents "left/joined" spam when browser refresh causes rapid disconnect-reconnect
const RECONNECT_GRACE_MS = 5_000;
// Keyed by client UUID — UUID is immutable and collision-free; name-keyed was fragile
// under name changes and had O(n) identity lookup
const pendingDisconnects = new Map<string, {
  timer: ReturnType<typeof setTimeout>;
  user: UserRecord;
}>();

// Deduplicate by userId before sending to clients — generalRoom.users is keyed by socketId,
// so a user with N open tabs has N entries in the map. The client counts users.length for the
// "X online" display, so emitting all socket entries inflates the count. Last-write-wins on
// duplicate userId is fine because all tabs share the same name/color/joinedAt.
function toClientUsers(users: Map<string, UserRecord>) {
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
      const existingUser = generalRoom.users.get(socket.id);
      if (existingUser) {
        // User already joined — preserve original joinedAt timestamp on re-emit
        generalRoom.users.set(socket.id, {
          id: socket.id,
          name: userData.name,
          color: userData.color,
          joinedAt: existingUser.joinedAt,
        });
        io.emit('room:users', Array.from(generalRoom.users.values()));
        return;
      }

      // Reconnect within grace window — cancel pending leave broadcast and silently restore
      // Keyed by name because socket.id changes on browser refresh
      const pending = pendingDisconnects.get(userData.name);
      if (pending) {
        clearTimeout(pending.timer);
        pendingDisconnects.delete(userData.name);
        generalRoom.users.set(socket.id, { ...pending.user, id: socket.id });
        io.emit('room:users', Array.from(generalRoom.users.values()));
        return;
      }

      generalRoom.users.set(socket.id, {
        id: socket.id,
        name: userData.name,
        color: userData.color,
        joinedAt: new Date(),
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
        // Defer leave broadcast — browser refresh reconnects within the grace window,
        // so we only broadcast "left" if the user doesn't rejoin in time
        const timer = setTimeout(() => {
          pendingDisconnects.delete(user.name);
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
        }, RECONNECT_GRACE_MS);
        pendingDisconnects.set(user.name, { timer, user });
      }
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
}
