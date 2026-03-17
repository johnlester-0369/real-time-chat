/**
 * Room Service
 *
 * Encapsulates all room state and event-handler logic for the real-time chat server.
 * Mirrors the web's services/socket.service.ts pattern — consumers (socket/index.ts)
 * interact with room state through typed methods rather than mutating the store directly,
 * keeping the wiring layer lean and the business logic independently testable.
 *
 * State previously in store.ts and utils.ts is owned privately here.
 * Handler functions previously in handlers/ are class methods here.
 *
 * @module socket/services/room.service
 */

// verbatimModuleSyntax: type-only imports must use 'import type'
import type { Server as SocketServer, Socket } from 'socket.io';
import type {
    Message,
    UserRecord,
    ClientUser,
    Room,
    PendingDisconnectEntry,
    ServerToClientEvents,
    ClientToServerEvents,
} from '../dtos/socket.dto.js';

// ============================================================================
// INTERNAL TYPES
// ============================================================================

// Typed aliases keep method signatures concise and consistent with lib/socket-server.ts
type AppSocketServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * RoomService — stateful room manager and protocol adapter.
 *
 * Owns the in-memory room state (messages, connected users, user registry,
 * pending disconnect timers) and exposes typed methods for each Socket.IO
 * event the server handles. Constructor seeds the room with welcome messages
 * so the state is valid the moment the first client connects.
 */
class RoomService {
    // --------------------------------------------------------------------------
    // STATE (replaces store.ts)
    // --------------------------------------------------------------------------

    // Grace period prevents "left/joined" spam when browser refresh causes rapid disconnect-reconnect
    private readonly RECONNECT_GRACE_MS = 5_000;

    // Pre-populated at class instantiation so seeds survive user churn — conditional injection
    // caused duplicates whenever the room emptied and a new connection arrived
    private readonly generalRoom: Room = {
        name: 'general',
        messages: [
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
        ],
        users: new Map(),
    };

    // Cross-session user store keyed by client UUID — preserves joinedAt and reserves the name
    // for returning users whose grace period has already expired (full page close and reopen)
    private readonly userRegistry = new Map
        <string, { name: string; color: string; joinedAt: Date }>();

    // Keyed by client UUID — UUID is immutable and collision-free; name-keyed was fragile
    // under name changes and had O(n) identity lookup
    private readonly pendingDisconnects = new Map<string, PendingDisconnectEntry>();

    // --------------------------------------------------------------------------
    // PRIVATE UTILITIES (inlined from utils.ts — RoomService is the sole consumer)
    // --------------------------------------------------------------------------

    // Deduplicate by userId before sending to clients — generalRoom.users is keyed by socketId,
    // so a user with N open tabs has N entries in the map. The client counts users.length for the
    // "X online" display, so emitting all socket entries inflates the count. Last-write-wins on
    // duplicate userId is fine because all tabs share the same name/color/joinedAt.
    private toClientUsers(users: Map<string, UserRecord>): ClientUser[] {
        const unique = new Map<string, ClientUser>();
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

    // --------------------------------------------------------------------------
    // PUBLIC API
    // --------------------------------------------------------------------------

    /**
     * Returns the current room snapshot for the initial history emit on connection.
     * Called immediately after a socket connects so the client can show online count
     * and seed messages before the user has even typed their name.
     */
    getHistory(): { room: string; messages: Message[]; users: ClientUser[] } {
        return {
            room: this.generalRoom.name,
            messages: this.generalRoom.messages,
            users: this.toClientUsers(this.generalRoom.users),
        };
    }

    /**
     * Handles user:join with idempotency, reconnect grace, name-uniqueness,
     * and first-join announcement logic.
     */
    handleJoin(
        io: AppSocketServer,
        socket: AppSocket,
        userData: { userId: string; name: string; color: string },
    ): void {
        // Idempotency check: socket already registered (duplicate emit from client side)
        const existingUser = this.generalRoom.users.get(socket.id);
        if (existingUser) {
            // Preserve original joinedAt — only update mutable display fields on re-emit
            this.generalRoom.users.set(socket.id, {
                ...existingUser,
                name: userData.name,
                color: userData.color,
            });
            io.emit('room:users', this.toClientUsers(this.generalRoom.users));
            return;
        }

        // Reconnect within grace window — cancel pending leave broadcast and silently restore.
        // UUID key means browser refresh (new socket.id, same UUID from URL) is correctly
        // identified as the same user, avoiding a spurious "left / joined" notification pair.
        const pending = this.pendingDisconnects.get(userData.userId);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingDisconnects.delete(userData.userId);
            this.generalRoom.users.set(socket.id, { ...pending.user, socketId: socket.id });
            io.emit('room:users', this.toClientUsers(this.generalRoom.users));
            return;
        }

        // Name uniqueness: a name is "taken" only if a *different* UUID currently holds it.
        // A known UUID reclaiming its own name (e.g. after grace expiry) is always allowed —
        // the name was reserved for them in userRegistry.
        const currentHolder = Array.from(this.generalRoom.users.values()).find(
            (u) => u.name.toLowerCase() === userData.name.toLowerCase(),
        );
        const nameTaken = currentHolder !== undefined && currentHolder.userId !== userData.userId;
        if (nameTaken) {
            socket.emit('error', {
                message: `"${userData.name}" is already taken. Please choose a different name.`,
            });
            return;
        }

        // Preserve original joinedAt for returning users whose grace period expired —
        // they were seen before so we don't reset their tenure in the room
        const registered = this.userRegistry.get(userData.userId);
        const joinedAt = registered?.joinedAt ?? new Date();
        const isNewUser = registered === undefined;

        const newUser: UserRecord = {
            socketId: socket.id,
            userId: userData.userId,
            name: userData.name,
            color: userData.color,
            joinedAt,
        };

        this.userRegistry.set(userData.userId, {
            name: userData.name,
            color: userData.color,
            joinedAt,
        });
        this.generalRoom.users.set(socket.id, newUser);
        io.emit('room:users', this.toClientUsers(this.generalRoom.users));

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
            this.generalRoom.messages.push(joinMsg);
            io.emit('message:new', joinMsg);
        }
    }

    /**
     * Handles message:send with ring-buffer cap and broadcast.
     */
    handleMessage(
        io: AppSocketServer,
        socket: AppSocket,
        data: { text: string },
    ): void {
        const user = this.generalRoom.users.get(socket.id);
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

        this.generalRoom.messages.push(message);

        // Ring-buffer cap: slice(-100) discards the oldest messages to prevent unbounded
        // memory growth while preserving recent history for late-joining clients
        if (this.generalRoom.messages.length > 100) {
            this.generalRoom.messages = this.generalRoom.messages.slice(-100);
        }

        io.emit('message:new', message);
    }

    /**
     * Returns the disconnect handler for a given socket.
     * Factory pattern — captures io and socket in a closure so the returned () => void
     * matches Socket.IO's expected listener signature exactly, keeping the binding in
     * index.ts as a one-liner: socket.on('disconnect', roomService.handleDisconnect(io, socket))
     */
    handleDisconnect(io: AppSocketServer, socket: AppSocket): () => void {
        return () => {
            const user = this.generalRoom.users.get(socket.id);
            if (user) {
                this.generalRoom.users.delete(socket.id);

                // Cancel any existing pending disconnect for this userId — multiple tabs sharing
                // the same URL/userId each produce their own socket, and rapid sequential closes
                // would leave a stale timer from the first close firing while the second is pending
                const existing = this.pendingDisconnects.get(user.userId);
                if (existing) clearTimeout(existing.timer);

                // Defer leave broadcast — browser refresh reconnects within the grace window,
                // so we only broadcast "left" if the user doesn't rejoin in time
                const timer = setTimeout(() => {
                    this.pendingDisconnects.delete(user.userId);

                    // Guard against multi-tab: generalRoom.users is keyed by socketId, so closing
                    // one of N tabs deletes only that socket — the userId may still be present on
                    // another socket. Only broadcast "left" when the userId is completely gone.
                    const hasActiveSocket = Array.from(this.generalRoom.users.values()).some(
                        (u) => u.userId === user.userId,
                    );
                    if (hasActiveSocket) return;

                    io.emit('room:users', this.toClientUsers(this.generalRoom.users));
                    const leaveMsg: Message = {
                        id: crypto.randomUUID(),
                        userId: 'system',
                        userName: 'System',
                        userColor: 'neutral',
                        text: `${user.name} left the room`,
                        timestamp: new Date(),
                    };
                    this.generalRoom.messages.push(leaveMsg);
                    io.emit('message:new', leaveMsg);
                }, this.RECONNECT_GRACE_MS);

                // Key by UUID — handleJoin's reconnect check looks up pendingDisconnects
                // by the same UUID from URL params, so this must match
                this.pendingDisconnects.set(user.userId, { timer, user });
            }
            console.log(`User disconnected: ${socket.id}`);
        };
    }
}

// ============================================================================
// SERVICE EXPORT
// ============================================================================

/**
 * Singleton service instance — import this directly in socket/index.ts.
 * Class is also exported for consumers who need to extend or mock it in tests.
 */
export { RoomService };
export const roomService = new RoomService();
