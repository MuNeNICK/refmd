'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth/authContext';
import { useSocketConnection } from './useSocketConnection';
import type { ScrapPost } from '@/lib/api/client';

interface UseScrapConnectionOptions {
  scrapId: string;
  shareToken?: string;
  onPostAdded?: (post: ScrapPost) => void;
  onPostUpdated?: (post: ScrapPost) => void;
  onPostDeleted?: (postId: string) => void;
  onContentUpdate?: () => void;
  onUserCountChanged?: (count: number) => void;
}

export function useScrapConnection({
  scrapId,
  shareToken,
  onPostAdded,
  onPostUpdated,
  onPostDeleted,
  onContentUpdate,
  onUserCountChanged
}: UseScrapConnectionOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Get auth token using the same method as documents
  const authToken = shareToken ? undefined : getAuthToken() || undefined;
  
  // Use the existing socket connection hook
  const { socket, isConnected: socketConnected } = useSocketConnection({
    token: shareToken,
    authToken
  });

  const hasJoinedRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastUpdateTimeRef = useRef<number>(0);

  // Debounced content update handler
  const debouncedContentUpdate = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Only update if enough time has passed since the last update
      if (now - lastUpdateTimeRef.current > 1000) {
        lastUpdateTimeRef.current = now;
        onContentUpdate?.();
      }
    }, 500); // 500ms debounce
  }, [onContentUpdate]);

  useEffect(() => {
    if (!socket || !socketConnected || hasJoinedRef.current) {
      return;
    }

    // Join the scrap document room
    const joinData: { document_id: string; shareToken?: string; auth_token?: string } = {
      document_id: scrapId
    };

    if (shareToken) {
      joinData.shareToken = shareToken;
    }

    if (authToken) {
      joinData.auth_token = authToken;
    }

    console.log('[Scrap] Emitting join_document:', {
      document_id: scrapId,
      hasShareToken: !!shareToken,
      hasAuthToken: !!authToken,
      authTokenLength: authToken?.length
    });

    socket.emit('join_document', joinData);
    hasJoinedRef.current = true;

    // Handle successful join
    const handleJoined = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    // Handle connection errors
    const handleError = (error: { error?: string; message?: string }) => {
      setConnectionError(error.error || error.message || 'Connection error');
      setIsConnected(false);
    };

    // Handle CRDT sync messages for real-time content updates
    const handleYjsSync = (message: { type: string }) => {
      // When CRDT content changes, we know posts have been updated
      if (message.type === 'Update') {
        console.log('[Scrap] CRDT update received, triggering debounced refresh');
        debouncedContentUpdate();
      }
    };

    // Handle awareness updates (user presence)
    const handleAwareness = (data: unknown) => {
      console.log('[Scrap] User presence update:', data);
    };

    // Handle direct scrap post events
    const handleScrapPostAdded = (post: ScrapPost) => {
      console.log('[Scrap] Post added:', post);
      onPostAdded?.(post);
    };

    const handleScrapPostUpdated = (post: ScrapPost) => {
      console.log('[Scrap] Post updated:', post);
      onPostUpdated?.(post);
    };

    const handleScrapPostDeleted = (data: { postId: string }) => {
      console.log('[Scrap] Post deleted:', data.postId);
      onPostDeleted?.(data.postId);
    };

    // Handle user count updates - this is the authoritative source
    const handleUserCountUpdate = (data: { count: number }) => {
      console.log('[Scrap] User count update:', data.count);
      onUserCountChanged?.(data.count);
    };

    // Handle user joined/left events (just for logging, count comes from user_count_update)
    const handleUserJoined = (data: unknown) => {
      console.log('[Scrap] User joined:', data);
    };

    const handleUserLeft = (data: unknown) => {
      console.log('[Scrap] User left:', data);
    };

    // Set up event listeners
    socket.on('joined-document', handleJoined);
    socket.on('error', handleError);
    socket.on('yjs:sync', handleYjsSync);
    socket.on('yjs:awareness', handleAwareness);
    socket.on('scrap_post_added', handleScrapPostAdded);
    socket.on('scrap_post_updated', handleScrapPostUpdated);
    socket.on('scrap_post_deleted', handleScrapPostDeleted);
    socket.on('user_count_update', handleUserCountUpdate);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);

    // Cleanup function
    return () => {
      socket.off('joined-document', handleJoined);
      socket.off('error', handleError);
      socket.off('yjs:sync', handleYjsSync);
      socket.off('yjs:awareness', handleAwareness);
      socket.off('scrap_post_added', handleScrapPostAdded);
      socket.off('scrap_post_updated', handleScrapPostUpdated);
      socket.off('scrap_post_deleted', handleScrapPostDeleted);
      socket.off('user_count_update', handleUserCountUpdate);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);

      if (hasJoinedRef.current) {
        socket.emit('leave_document', { document_id: scrapId });
        hasJoinedRef.current = false;
      }
      setIsConnected(false);
      
      // Clear debounce timer
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [socket, socketConnected, scrapId, shareToken, authToken, debouncedContentUpdate]);

  // Handle socket disconnection
  useEffect(() => {
    if (!socketConnected) {
      setIsConnected(false);
      hasJoinedRef.current = false;
    }
  }, [socketConnected]);

  // Helper functions to emit post events
  const emitPostAdded = useCallback((post: ScrapPost) => {
    if (socket && isConnected) {
      socket.emit('scrap_post_added', { 
        document_id: scrapId,
        ...post 
      });
    }
  }, [socket, isConnected, scrapId]);

  const emitPostUpdated = useCallback((post: ScrapPost) => {
    if (socket && isConnected) {
      socket.emit('scrap_post_updated', { 
        document_id: scrapId,
        ...post 
      });
    }
  }, [socket, isConnected, scrapId]);

  const emitPostDeleted = useCallback((postId: string) => {
    if (socket && isConnected) {
      socket.emit('scrap_post_deleted', { 
        document_id: scrapId,
        postId 
      });
    }
  }, [socket, isConnected, scrapId]);

  return {
    isConnected,
    connectionError,
    socket,
    socketConnected,
    emitPostAdded,
    emitPostUpdated,
    emitPostDeleted
  };
}