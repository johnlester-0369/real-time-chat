import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, ChatUser, UserColor, ServerToClientEvents, ClientToServerEvents } from '@/types/chat.types';

let globalSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function useSocket(user?: { userId: string; name: string; color: UserColor } | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const socketRef = useRef<typeof globalSocket>(globalSocket);
  const userRef = useRef(user);
  const hasJoinedRef = useRef(false);

  // Keep user ref in sync with prop — needed for connect handler to access latest user
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:3000', {
        withCredentials: true,
        autoConnect: true,
      });
      globalSocket = socketRef.current;
    }

    const socket = socketRef.current;

    const onConnect = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      hasJoinedRef.current = false;
      // Join immediately if we have user data — otherwise wait for user effect to trigger join
      if (userRef.current && !hasJoinedRef.current) {
        socket.emit('user:join', userRef.current);
        hasJoinedRef.current = true;
      }
    };

    const onDisconnect = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      hasJoinedRef.current = false;
    };

    const onRoomHistory = (data: { room: string; messages: Message[]; users: ChatUser[] }) => {
      setMessages(data.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })));
    setUsers(data.users.map(u => ({ ...u, joinedAt: new Date(u.joinedAt) })));
  };

  const onMessageNew = (message: Message) => {
      setMessages(prev => [
        ...prev,
        { ...message, timestamp: new Date(message.timestamp) }
      ]);
  };

  const onRoomUsers = (updatedUsers: ChatUser[]) => {
    setUsers(updatedUsers.map(u => ({ ...u, joinedAt: new Date(u.joinedAt) })));
  };

  const onError = (data: { message: string }) => {
      console.error('WebSocket error:', data.message);
      setError(data.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:history', onRoomHistory);
    socket.on('message:new', onMessageNew);
    socket.on('room:users', onRoomUsers);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:history', onRoomHistory);
      socket.off('message:new', onMessageNew);
      socket.off('room:users', onRoomUsers);
      socket.off('error', onError);
    };
  }, []);

  // Separate effect: join room when user becomes available after socket is already connected
  // This handles the case where user submits name AFTER initial connection
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && isConnected && user && !hasJoinedRef.current) {
      socket.emit('user:join', user);
      hasJoinedRef.current = true;
    }
  }, [user, isConnected]);

  const sendMessage = useCallback((text: string) => {
    if (socketRef.current && isConnected && text.trim()) {
      socketRef.current.emit('message:send', { text: text.trim() });
    } else if (!isConnected) {
      setError('Cannot send message: not connected');
    }
  }, [isConnected]);

  return {
    isConnected,
    messages,
    users,
    sendMessage,
    error,
  };
}
