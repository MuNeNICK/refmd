import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/auth/authContext';
import { getSocketUrl } from '@/lib/config';

export type UseSocketConnectionOptions = {
  token?: string; // Share token
  authToken?: string; // Auth token
};

export type UseSocketConnectionReturn = {
  socket: Socket | null;
  isConnected: boolean;
};

export function useSocketConnection({ token, authToken }: UseSocketConnectionOptions = {}): UseSocketConnectionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Skip if socket already exists
    if (socketRef.current) {
      return;
    }

    // Get auth token
    const finalAuthToken = authToken || getAuthToken();
    
    // For shared links, we don't need an auth token - the share token will be used for authorization
    if (!finalAuthToken && !token) {
      // No authentication token or share token available
      return;
    }

    // Create socket connection
    const socket = io(getSocketUrl(), {
      auth: {
        token: finalAuthToken || '',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Handle connection events
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      // Socket.io connection error
      setIsConnected(false);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, authToken]);

  // Return stable references
  return {
    socket: socketRef.current,
    isConnected,
  };
}