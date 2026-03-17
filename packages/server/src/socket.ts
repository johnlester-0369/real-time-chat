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

    // Send history immediately on connect so the client can show online count and
    // seed messages before the user has even typed their name
    socket.emit('room:history', {
      room: 'general',
      messages: generalRoom.messages,
      users: toClientUsers(generalRoom.users),
    });

    socket.on('user:join', (userData: { userId: string; name: string; color: string }) => {
      // Idempotency check: socket already registered (duplicate emit from client side)
      const existingUser = generalRoom.users.get(socket.id);
      if (existingUser) {
        // Preserve original joinedAt — only update mutable fields on re-emit
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
    });

    socket.on('message:send', (data: { text: string }) => {
      const user = generalRoom.users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'You must join first' });
        return;
      }

      const message: Message = {
        id: crypto.randomUUID(),
        // Client UUID as message author — the client's isMessageFromMe checks this field,
        // so it must be the stable UUID, not socket.id which changes on every reconnect
        userId: user.userId,
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
    });
  });

  return io;
}