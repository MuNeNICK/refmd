import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import { SocketIOProvider } from '@/lib/providers/socketio-provider';
import { Awareness } from 'y-protocols/awareness';
import { getAuthToken } from '@/lib/auth/authContext';

export function useCollaborativeDocument({
  documentId,
  socket,
  shareToken,
  onSync,
  onConnectionError,
}: {
  documentId: string;
  socket: Socket | null;
  shareToken?: string;
  onSync?: (synced: boolean) => void;
  onConnectionError?: (error: unknown) => void;
}): {
  doc: Y.Doc | null;
  provider: SocketIOProvider | null;
  awareness: Awareness | null;
  synced: boolean;
  connected: boolean;
  getText: () => Y.Text | null;
} {
  const [synced, setSynced] = useState(false);
  const [connected, setConnected] = useState(false);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!socket || !documentId) {
      return;
    }

    // Prevent double initialization in development
    if (initializingRef.current || provider) {
      return;
    }
    
    initializingRef.current = true;
    
    // Create Y.Doc instance
    const newDoc = new Y.Doc();
    setDoc(newDoc);

    // Create awareness
    const newAwareness = new Awareness(newDoc);
    setAwareness(newAwareness);

    // Get auth token if no share token is provided
    const authToken = shareToken ? undefined : (typeof window !== 'undefined' ? getAuthToken() : null) || undefined;
    
    // Create provider
    const newProvider = new SocketIOProvider(socket, documentId, newDoc, {
      awareness: newAwareness,
      shareToken,
      authToken,
    });
    setProvider(newProvider);

    // Handle sync status
    newProvider.on('sync', (...args: unknown[]) => {
      const isSynced = args[0] as boolean;
      setSynced(isSynced);
      onSync?.(isSynced);
    });

    // Handle connection status
    newProvider.on('status', (...args: unknown[]) => {
      const statusObj = args[0] as { status: string };
      const isConnected = statusObj?.status === 'connected';
      setConnected(isConnected);
    });

    // Handle connection errors
    newProvider.on('connection-error', (...args: unknown[]) => {
      const error = args[0];
      onConnectionError?.(error);
    });

    // Handle page unload - ensure all updates are sent
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Flush any pending updates
      if (newProvider) {
        newProvider.flushPendingUpdates();
        
        // If there are unsaved changes, show a warning
        if (newProvider.hasPendingUpdates()) {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Store references to clean up
      const providerToCleanup = newProvider;
      const awarenessToCleanup = newAwareness;
      const docToCleanup = newDoc;
      
      // Small delay to prevent immediate cleanup in StrictMode double mount
      setTimeout(() => {
        // Only cleanup if the current state still points to these instances
        if (provider === providerToCleanup && providerToCleanup) {
          (providerToCleanup as SocketIOProvider).destroy();
          setProvider(null);
        }
        if (awareness === awarenessToCleanup && awarenessToCleanup) {
          (awarenessToCleanup as Awareness).destroy();
          setAwareness(null);
        }
        if (doc === docToCleanup && docToCleanup) {
          (docToCleanup as Y.Doc).destroy();
          setDoc(null);
        }
        initializingRef.current = false;
      }, 100);
    };
  }, [socket, documentId, onSync, onConnectionError, provider, awareness, doc, shareToken]);

  const getText = useCallback(() => {
    if (!doc) return null;
    return doc.getText('content');
  }, [doc]);

  
  return {
    doc,
    provider,
    awareness,
    synced,
    connected,
    getText,
  };
}