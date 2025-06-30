import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/auth/authContext';
import { getSocketUrl } from '@/lib/config';

export function useSocketConnection({ token, authToken }: {
  token?: string; // Share token
  authToken?: string; // Auth token
} = {}): {
  socket: Socket | null;
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Skip if socket already exists
    if (socketRef.current) {
      return;
    }

    // Get auth token - but don't use it if we have a share token
    const finalAuthToken = token ? undefined : (authToken || getAuthToken());
    
    // For shared links, we don't need an auth token - the share token will be used for authorization
    if (!finalAuthToken && !token) {
      // No authentication token or share token available
      console.log('[useSocketConnection] No auth token or share token available, skipping connection');
      return;
    }

    // Create socket connection
    // Only include auth token if we're not using a share token
    const socketOptions: {
      transports: string[];
      reconnection: boolean;
      reconnectionAttempts: number;
      reconnectionDelay: number;
      reconnectionDelayMax: number;
      randomizationFactor: number;
      pingInterval: number;
      pingTimeout: number;
      timeout: number;
      auth?: { token: string } | { shareToken: string };
    } = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,  // Keep trying to reconnect indefinitely
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,     // Max delay between reconnection attempts (10s)
      randomizationFactor: 0.5,        // Add jitter to prevent thundering herd
      pingInterval: 25000,             // Send ping every 25 seconds
      pingTimeout: 20000,              // Wait 20 seconds for pong response
      timeout: 20000,                  // Initial connection timeout (20s)
    };
    
    // Only add auth if we have a valid token and not using a share token
    if (finalAuthToken && !token) {
      socketOptions.auth = {
        token: finalAuthToken,
      };
    }
    
    const socket = io(getSocketUrl(), socketOptions);

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