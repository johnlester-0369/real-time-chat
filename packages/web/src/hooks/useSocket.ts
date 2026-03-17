/**
 * useSocket Hook
 *
 * Orchestrates React state for the real-time chat connection.
 * Delegates all socket lifecycle and protocol concerns to the service layer:
 *   - lib/socket-client.ts  → owns the singleton Socket.IO connection
 *   - services/socket.service.ts → owns all emit/subscribe calls
 *
 * This hook is deliberately limited to React state transitions and effect
 * lifecycle so it stays testable with a mocked socketService.
 *
 * @module hooks/useSocket
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/services/socket.service';
import type { Message, ChatUser, UserColor } from '@/dtos/chat.dto';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSocketUser {
  userId: string;
  name: string;
  color: UserColor;
}

export interface UseSocketReturn {
  isConnected: boolean;
  messages: Message[];
  users: ChatUser[];
  sendMessage: (text: string) => void;
  clearError: () => void;
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Connects to the chat server and exposes reactive state for the calling component.
 *
 * Pass a user object to join the room. Passing null/undefined keeps the socket
 * alive but defers the join — used on the NameEntryScreen before identity is known.
 */
export function useSocket(user?: UseSocketUser | null): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);

  // Refs track values that must be accessible inside stable callbacks without
  // causing effect re-runs — avoids stale closure issues in onConnect
  const userRef = useRef(user);
  const hasJoinedRef = useRef(false);

  // Keep userRef current on every render so the connect handler always sees
  // the latest user object even if it fires after a prop update
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // --------------------------------------------------------------------------
  // SOCKET EVENT HANDLERS (defined outside subscribe so refs are stable)
  // --------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = socketService.subscribe({
      onConnect() {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        // Reset join flag on every reconnect so the join handshake replays
        // after a server restart or network drop — without this, the user
        // would be invisible in the room after reconnection
        hasJoinedRef.current = false;
        if (userRef.current && !hasJoinedRef.current) {
          socketService.join(userRef.current);
          hasJoinedRef.current = true;
        }
      },

      onDisconnect() {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        hasJoinedRef.current = false;
      },

      onRoomHistory(data) {
        // Coerce ISO timestamp strings to Date objects — the server serialises
        // Date as string over JSON; keeping Dates in state avoids repeated
        // parsing on every render cycle
        setMessages(
          data.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
        );
        setUsers(data.users.map(u => ({ ...u, joinedAt: new Date(u.joinedAt) })));
      },

      onMessageNew(message) {
        setMessages(prev => [
          ...prev,
          { ...message, timestamp: new Date(message.timestamp) },
        ]);
      },

      onRoomUsers(updatedUsers) {
        setUsers(updatedUsers.map(u => ({ ...u, joinedAt: new Date(u.joinedAt) })));
      },

      onError(data) {
        console.error('WebSocket error:', data.message);
        setError(data.message);
      },
    });

    // socketService.subscribe() returns a symmetric unsubscribe function —
    // calling it here prevents listener accumulation across StrictMode double-mounts
    return unsubscribe;
  }, []);

  // --------------------------------------------------------------------------
  // DEFERRED JOIN EFFECT
  // --------------------------------------------------------------------------

  // Handles the case where the user submits their name *after* the socket has
  // already connected — the connect handler above only fires on (re)connection,
  // so this effect catches the user→non-null transition mid-session
  useEffect(() => {
    if (isConnected && user && !hasJoinedRef.current) {
      socketService.join(user);
      hasJoinedRef.current = true;
    }
  }, [user, isConnected]);

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------

  const sendMessage = useCallback(
    (text: string) => {
      if (isConnected && text.trim()) {
        socketService.sendMessage(text.trim());
      }
      // Silently drop if disconnected — App.tsx disables the send button
      // while offline, so this branch is a safety net, not a primary path
    },
    [isConnected],
  );

  // Allow callers to dismiss socket errors — needed when retrying with a
  // different name after the server rejects a join
  const clearError = useCallback(() => setError(null), []);

  // --------------------------------------------------------------------------
  // RETURN
  // --------------------------------------------------------------------------

  return {
    isConnected,
    messages,
    users,
    sendMessage,
    clearError,
    error,
  };
}
