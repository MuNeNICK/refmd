import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/auth/authContext';
import { getSocketUrl } from '@/lib/config';

export type UseSocketConnectionOptions = {
  token?: string; // Share token
};

export type UseSocketConnectionReturn = {
  socket: Socket | null;
  isConnected: boolean;
};

export function useSocketConnection({ token }: UseSocketConnectionOptions = {}): UseSocketConnectionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Skip if socket already exists
    if (socketRef.current) {
      return;
    }

    // Get auth token
    const authToken = token || getAuthToken();
    
    if (!authToken) {
      // No authentication token available
      return;
    }

    // Create socket connection
    const socket = io(getSocketUrl(), {
      auth: {
        token: authToken,
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
  }, [token]);

  // Return stable references
  return {
    socket: socketRef.current,
    isConnected,
  };
}