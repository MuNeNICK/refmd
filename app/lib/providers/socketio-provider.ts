import * as Y from 'yjs';
import { Observable } from 'lib0/observable';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { Socket } from 'socket.io-client';

// Generate a color based on a string
function generateColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const hue = Math.abs(hash) % 360;
  const saturation = 70;
  const lightness = 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}


export class SocketIOProvider extends Observable<string> {
  doc: Y.Doc;
  awareness: Awareness;
  socket: Socket;
  documentId: string;
  shareToken?: string;
  authToken?: string;
  private _synced: boolean = false;
  private _hasError: boolean = false;
  private _lastError?: string;
  private _hasJoined: boolean = false;
  private _joiningInProgress: boolean = false;
  private resyncInterval: number;
  private resyncTimer?: NodeJS.Timeout;
  private messageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private _docUpdateHandler?: (update: Uint8Array, origin: unknown) => void;
  private _awarenessUpdateHandler?: (data: { added: number[], updated: number[], removed: number[] }) => void;
  private _pendingUpdates: Array<{ update: string; timestamp: number }> = [];
  private _reconnectAttempts: number = 0;
  private _maxReconnectDelay: number = 30000; // 30 seconds max delay
  private _connectionRetryCount: number = 0;
  private _lastConnectionTime: number = Date.now();
  private _connectionHealthTimer?: NodeJS.Timeout;


  constructor(
    socket: Socket,
    documentId: string,
    doc: Y.Doc,
    options: {
      awareness?: Awareness;
      resyncInterval?: number;
      shareToken?: string;
      authToken?: string;
    } = {}
  ) {
    super();
    this.socket = socket;
    this.documentId = documentId;
    this.doc = doc;
    this.shareToken = options.shareToken;
    this.authToken = options.authToken;
    this.awareness = options.awareness || new Awareness(doc);
    this.resyncInterval = options.resyncInterval || 5000;

    this._setupSocketHandlers();
    
    // Set up doc handlers immediately to catch all updates
    this._setupDocHandlers();
    this._setupAwarenessHandlers();
    
    // Join document room only if already connected
    if (this.socket.connected) {
      this._joinDocument();
    }
  }

  private _setupSocketHandlers() {
    // Handle connection
    this.socket.on('connect', () => {
      const now = Date.now();
      const timeSinceLastConnection = now - this._lastConnectionTime;
      this._lastConnectionTime = now;
      
      // Log connection metrics for debugging
      console.log(`[SocketIOProvider] Connected. Time since last connection: ${timeSinceLastConnection}ms, Retry count: ${this._connectionRetryCount}`);
      this._connectionRetryCount = 0; // Reset retry count on successful connection
      
      this._synced = false;
      this._reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Don't reset _hasJoined on reconnect if we were already joined
      // This prevents rejoining on temporary disconnects
      if (!this._hasJoined) {
        this._hasJoined = false;
        this._joiningInProgress = false;
      }
      this.clearError(); // Clear any previous errors
      this.emit('status', [{ status: 'connected' }]);
      
      // Only join if not already joined and not already joining
      if (!this._hasJoined && !this._joiningInProgress) {
        this._joinDocument();
      }
      
      // Start connection health monitoring
      this._startConnectionHealthCheck();
    });

    // Handle disconnection
    this.socket.on('disconnect', (reason: string) => {
      this._connectionRetryCount++;
      console.log(`[SocketIOProvider] Disconnected. Reason: ${reason}, Retry count: ${this._connectionRetryCount}`);
      
      this._synced = false;
      this._hasJoined = false; // Reset join state on disconnect
      this._joiningInProgress = false; // Reset joining state
      this.emit('status', [{ status: 'disconnected' }]);
      
      // Handle reconnection with exponential backoff
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this._handleReconnect();
      }
      
      // Stop health check on disconnect
      this._stopConnectionHealthCheck();
    });
    
    // Handle reconnect attempts
    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`[SocketIOProvider] Reconnection attempt ${attemptNumber}`);
      this.emit('status', [{ status: 'reconnecting', attempt: attemptNumber }]);
    });

    // Handle sync messages
    this.socket.on('yjs:sync', (message: unknown) => {
      this._handleSyncMessage(message);
    });

    // Handle awareness messages
    this.socket.on('yjs:awareness', (data: ArrayBuffer | Uint8Array | number[] | string) => {
      let uint8Data: Uint8Array;
      
      if (data instanceof ArrayBuffer) {
        uint8Data = new Uint8Array(data);
      } else if (data instanceof Uint8Array) {
        uint8Data = data;
      } else if (Array.isArray(data)) {
        // Convert regular array back to Uint8Array
        uint8Data = new Uint8Array(data);
      } else if (typeof data === 'string') {
        // Decode base64 string
        const binaryString = atob(data);
        uint8Data = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Data[i] = binaryString.charCodeAt(i);
        }
      } else {
        console.error('[SocketIOProvider] Unknown awareness data format:', data);
        return;
      }
      
      applyAwarenessUpdate(
        this.awareness,
        uint8Data,
        this.socket.id || 'unknown'
      );
    });

    // Handle document loaded event
    this.socket.on('document-loaded', () => {
      // Initial sync will be handled by yjs:sync messages
      this.emit('synced', []);
    });

    // Handle successful join
    this.socket.on('joined-document', () => {
      // Prevent processing multiple join confirmations
      if (this._hasJoined) {
        return;
      }
      
      this._hasJoined = true;
      this._joiningInProgress = false; // Clear joining flag
      
      // Send any pending updates
      if (this._pendingUpdates.length > 0) {
        for (const pending of this._pendingUpdates) {
          this.socket.emit('yjs:sync', {
            type: 'Update',
            data: {
              document_id: this.documentId,
              update: pending.update
            }
          });
        }
        this._pendingUpdates = [];
      }
      
      // Request sync only if not already synced
      if (!this._synced) {
        this._requestSync();
      }
    });

    // Handle errors
    this.socket.on('error', (error: { error?: string; message?: string }) => {
      this._hasError = true;
      this._lastError = error.error || error.message || 'Connection error';
      this._hasJoined = false; // Reset join status on error
      this._joiningInProgress = false; // Clear joining flag on error
      this.emit('connection-error', [error]);
      this.emit('status', [{ status: 'error', error: this._lastError }]);
    });

    // Handle sync errors
    this.socket.on('sync-error', (error: { message?: string }) => {
      this._hasError = true;
      this._lastError = error.message || 'Sync error';
      this.emit('sync-error', [error]);
      this.emit('status', [{ status: 'sync-error', error: this._lastError }]);
    });
  }

  private _setupDocHandlers() {
    // Listen for document updates
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      
      if (origin !== this) {
        const updateBase64 = btoa(String.fromCharCode(...update));
        
        if (this._hasJoined) {
          // Send update to server immediately
          this.socket.emit('yjs:sync', {
            type: 'Update',
            data: {
              document_id: this.documentId,
              update: updateBase64
            }
          });
        } else {
          // Queue update to send after joining
          this._pendingUpdates.push({
            update: updateBase64,
            timestamp: Date.now()
          });
        }
      } else {
      }
    };
    
    this.doc.on('update', updateHandler);
    
    // Store handler reference for cleanup
    this._docUpdateHandler = updateHandler;
  }

  private _setupAwarenessHandlers() {
    // Check if awareness is already destroyed
    if ((this.awareness as unknown as { _destroyed?: boolean })._destroyed) {
      return;
    }

    // Listen for awareness updates
    const awarenessHandler = ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
      if (this._hasJoined) {
        const changedClients = added.concat(updated).concat(removed);
        
        // Encode awareness update directly without message type prefix
        const awarenessData = encodeAwarenessUpdate(this.awareness, changedClients);
        // Convert to regular array for Socket.IO transmission
        // Socket.IO v4 has issues with Uint8Array, so we convert to regular array
        const dataArray = Array.from(awarenessData);
        this.socket.emit('yjs:awareness', dataArray);
      }
    };
    
    this.awareness.on('update', awarenessHandler);
    
    // Store handler reference for cleanup
    this._awarenessUpdateHandler = awarenessHandler;

    // Set local state
    this.awareness.setLocalState({
      user: {
        id: this.socket.id,
        color: generateColor(this.socket.id || ''),
        name: 'Anonymous',
      },
    });
  }

  private _handleSyncMessage(message: unknown) {
    const msg = message as { type?: string; data?: { update?: string; state_vector?: string } };
    if (!msg || !msg.type || !msg.data) {
      return;
    }

    try {
      switch (msg.type) {
        case 'SyncStep1':
          // Server is requesting sync step 1 (shouldn't happen in normal flow)
          break;

        case 'SyncStep2':
          // Server is sending sync step 2 (document state)
          const updateData = this._base64ToUint8Array(msg.data.update || '');
          
          try {
            Y.applyUpdate(this.doc, updateData, this);
            
            // Mark as synced after receiving initial state
            if (!this._synced) {
              this._synced = true;
              this.emit('sync', [true]);
              this.emit('status', [{ status: 'connected' }]);
            }
          } catch (err) {
            throw err;
          }
          break;

        case 'Update':
          // Server is sending an update
          const update = this._base64ToUint8Array(msg.data.update || '');
          
          try {
            Y.applyUpdate(this.doc, update, this);
            
            if (!this._synced) {
              this._synced = true;
              this.emit('sync', [true]);
              this.emit('status', [{ status: 'connected' }]);
            }
          } catch (err) {
            throw err;
          }
          break;

        default:
      }
    } catch {
      // Error handling sync message
    }
  }

  private _base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
  }


  private _requestSync() {
    if (!this._hasJoined) {
      return;
    }
    
    // Send sync step 1 to server
    const stateVector = Y.encodeStateVector(this.doc);
    const stateVectorBase64 = btoa(String.fromCharCode(...stateVector));
    
    this.socket.emit('yjs:sync', {
      type: 'SyncStep1',
      data: {
        document_id: this.documentId,
        state_vector: stateVectorBase64
      }
    });

    // Set up periodic resync (only when not synced)
    if (this.resyncTimer) {
      clearInterval(this.resyncTimer);
    }
    this.resyncTimer = setInterval(() => {
      if (this.socket.connected && this._hasJoined && !this._synced) {
        const stateVector = Y.encodeStateVector(this.doc);
        const stateVectorBase64 = btoa(String.fromCharCode(...stateVector));
        
        this.socket.emit('yjs:sync', {
          type: 'SyncStep1',
          data: {
            document_id: this.documentId,
            state_vector: stateVectorBase64
          }
        });
      }
    }, this.resyncInterval);
  }

  get synced(): boolean {
    return this._synced;
  }

  get hasError(): boolean {
    return this._hasError;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  clearError(): void {
    this._hasError = false;
    this._lastError = undefined;
  }

  private _joinDocument(): void {
    // Prevent multiple join requests - check both _hasJoined and if we're already in the process
    if (this._hasJoined || this._joiningInProgress) {
      console.log('[SocketIOProvider] Join already in progress or completed, skipping');
      return;
    }
    
    console.log('[SocketIOProvider] Joining document:', this.documentId);
    this._joiningInProgress = true; // Flag to prevent concurrent joins
    const joinData: { document_id: string; shareToken?: string; auth_token?: string } = { 
      document_id: this.documentId
    };
    
    // Add share token if available
    if (this.shareToken) {
      joinData.shareToken = this.shareToken;
    }
    
    // Add auth token if available
    if (this.authToken) {
      joinData.auth_token = this.authToken;
    }
    
    this.socket.emit('join_document', joinData);
    
    // Set a timeout to reset joining state if no response
    setTimeout(() => {
      if (this._joiningInProgress && !this._hasJoined) {
        console.warn('[SocketIOProvider] Join timeout, resetting state');
        this._joiningInProgress = false;
      }
    }, 5000); // 5 second timeout
  }

  private _getAuthToken(): string {
    // Get token from localStorage
    return localStorage.getItem('token') || '';
  }

  private _handleReconnect(): void {
    // Calculate delay with exponential backoff
    const baseDelay = 1000; // 1 second
    const delay = Math.min(
      baseDelay * Math.pow(2, this._reconnectAttempts),
      this._maxReconnectDelay
    );
    
    this._reconnectAttempts++;
    
    console.log(`[SocketIOProvider] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.socket.connected) {
        this.socket.connect();
      }
    }, delay);
  }

  // Flush any pending updates immediately
  flushPendingUpdates(): void {
    if (this._hasJoined && this._pendingUpdates.length > 0) {
      for (const pending of this._pendingUpdates) {
        this.socket.emit('yjs:sync', {
          type: 'Update',
          data: {
            document_id: this.documentId,
            update: pending.update
          }
        });
      }
      this._pendingUpdates = [];
    }
  }

  // Check if there are pending updates
  hasPendingUpdates(): boolean {
    return this._pendingUpdates.length > 0;
  }

  private _startConnectionHealthCheck(): void {
    // Clear any existing timer
    this._stopConnectionHealthCheck();
    
    // Check connection health every 30 seconds
    this._connectionHealthTimer = setInterval(() => {
      if (!this.socket.connected) {
        console.warn('[SocketIOProvider] Connection health check failed - socket not connected');
        // Force reconnection if socket thinks it's connected but isn't
        if (this.socket.active) {
          console.log('[SocketIOProvider] Forcing reconnection...');
          this.socket.disconnect();
          this.socket.connect();
        }
      } else if (!this._synced && this._hasJoined) {
        // If we're connected and joined but not synced for too long, request sync again
        console.log('[SocketIOProvider] Connected but not synced, requesting sync...');
        this._requestSync();
      }
    }, 30000); // Check every 30 seconds
  }
  
  private _stopConnectionHealthCheck(): void {
    if (this._connectionHealthTimer) {
      clearInterval(this._connectionHealthTimer);
      this._connectionHealthTimer = undefined;
    }
  }

  private _destroyed = false;

  destroy() {
    // Prevent double destruction
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;

    // Flush any remaining updates before destroying
    this.flushPendingUpdates();
    
    // Clean up
    if (this.resyncTimer) {
      clearInterval(this.resyncTimer);
    }
    
    // Stop connection health check
    this._stopConnectionHealthCheck();
    
    // Leave document only if we actually joined
    if (this._hasJoined) {
      this.socket.emit('leave_document', { document_id: this.documentId });
    }
    
    // Clear flags
    this._hasJoined = false;
    this._joiningInProgress = false;
    this._synced = false;
    
    // Remove all listeners
    if (this._docUpdateHandler) {
      this.doc.off('update', this._docUpdateHandler);
      this._docUpdateHandler = undefined;
    }
    if (this._awarenessUpdateHandler && this.awareness && typeof this.awareness.off === 'function') {
      try {
        this.awareness.off('update', this._awarenessUpdateHandler);
      } catch (error) {
        // Ignore errors when removing handlers - awareness might already be destroyed
        if (!(error as Error)?.message?.includes('event handler')) {
          console.error('Error removing awareness handler:', error);
        }
      }
      this._awarenessUpdateHandler = undefined;
    }
    // Don't destroy awareness - it's not owned by this provider
    // The awareness instance is passed in and should be managed by its owner
    
    // Remove socket listeners
    this.socket.off('connect');
    this.socket.off('disconnect');
    this.socket.off('yjs:sync');
    this.socket.off('yjs:awareness');
    this.socket.off('document-loaded');
    this.socket.off('joined-document');
    this.socket.off('error');
    this.socket.off('sync-error');
    
    super.destroy();
  }
}