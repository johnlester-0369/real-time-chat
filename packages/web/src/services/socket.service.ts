/**
 * Socket Service
 *
 * Encapsulates all Socket.IO emit calls and event subscription management.
 * Consumers (hooks, components) interact with the chat protocol through this
 * service rather than calling socket.emit/on directly — keeping them decoupled
 * from the underlying wire format so the protocol can evolve independently.
 *
 * @module services/socket.service
 */

import { getSocketClient, type AppSocket } from '@/lib/socket-client';
import type {
  Message,
  ChatUser,
  UserColor,
} from '@/dtos/chat.dto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * User payload required to join a room.
 * Mirrors the ClientToServerEvents['user:join'] argument shape.
 */
export interface JoinPayload {
  userId: string;
  name: string;
  color: UserColor;
}

/**
 * Subset of ServerToClientEvents that callers can subscribe to via this service.
 * Using a mapped type keeps this in sync with the canonical event definitions
 * in chat.types.ts automatically.
 */
export type SocketEventHandlers = Partial<{
  onConnect: () => void;
  onDisconnect: () => void;
  onRoomHistory: (data: { room: string; messages: Message[]; users: ChatUser[] }) => void;
  onMessageNew: (message: Message) => void;
  onRoomUsers: (users: ChatUser[]) => void;
  onError: (data: { message: string }) => void;
}>;

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * SocketService — thin protocol adapter over Socket.IO.
 *
 * Each instance holds a reference to the shared AppSocket singleton.
 * Methods are intentionally side-effect-free beyond the socket call itself
 * so that callers (hooks) own all React state transitions.
 */
class SocketService {
  private get socket(): AppSocket {
    // Resolved lazily so the service can be instantiated at module load time
    // without triggering the socket connection prematurely
    return getSocketClient();
  }

  // --------------------------------------------------------------------------
  // EMIT METHODS
  // --------------------------------------------------------------------------

  /**
   * Emits user:join to register the user in the default room.
   * Must be called after the socket connects and user identity is confirmed.
   */
  join(user: JoinPayload): void {
    this.socket.emit('user:join', user);
  }

  /**
   * Emits message:send with the provided text.
   * Callers are responsible for trimming and validating before calling.
   */
  sendMessage(text: string): void {
    this.socket.emit('message:send', { text });
  }

  // --------------------------------------------------------------------------
  // SUBSCRIPTION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Attaches all provided event handlers to the underlying socket.
   * Returns a cleanup function that removes the same handlers — designed
   * to be called inside a useEffect return value for automatic teardown.
   *
   * Using an explicit handlers object (vs individual on/off calls at the hook
   * level) ensures subscribe and unsubscribe are always symmetric — no risk of
   * forgetting to remove a listener that was added.
   */
  subscribe(handlers: SocketEventHandlers): () => void {
    const { socket } = this;

    if (handlers.onConnect) socket.on('connect', handlers.onConnect);
    if (handlers.onDisconnect) socket.on('disconnect', handlers.onDisconnect);
    if (handlers.onRoomHistory) socket.on('room:history', handlers.onRoomHistory);
    if (handlers.onMessageNew) socket.on('message:new', handlers.onMessageNew);
    if (handlers.onRoomUsers) socket.on('room:users', handlers.onRoomUsers);
    if (handlers.onError) socket.on('error', handlers.onError);

    // Return teardown so callers don't need to hold handler references for cleanup
    return () => this.unsubscribe(handlers);
  }

  /**
   * Removes all provided event handlers from the underlying socket.
   * Accepts the same handlers object used in subscribe() to guarantee symmetry.
   */
  unsubscribe(handlers: SocketEventHandlers): void {
    const { socket } = this;

    if (handlers.onConnect) socket.off('connect', handlers.onConnect);
    if (handlers.onDisconnect) socket.off('disconnect', handlers.onDisconnect);
    if (handlers.onRoomHistory) socket.off('room:history', handlers.onRoomHistory);
    if (handlers.onMessageNew) socket.off('message:new', handlers.onMessageNew);
    if (handlers.onRoomUsers) socket.off('room:users', handlers.onRoomUsers);
    if (handlers.onError) socket.off('error', handlers.onError);
  }

  // --------------------------------------------------------------------------
  // ACCESSORS
  // --------------------------------------------------------------------------

  /**
   * Exposes the raw socket for edge cases where direct access is unavoidable
   * (e.g. reading socket.id for debugging). Prefer the typed methods above.
   */
  getRawSocket(): AppSocket {
    return this.socket;
  }
}

// ============================================================================
// SERVICE EXPORT
// ============================================================================

/**
 * Singleton service instance — import this directly in hooks and components.
 * Class is also exported for consumers who need to extend or mock it in tests.
 */
export { SocketService };
export const socketService = new SocketService();
