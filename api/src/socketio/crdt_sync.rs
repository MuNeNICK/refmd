
use std::sync::Arc;
use uuid::Uuid;
use socketioxide::extract::SocketRef;
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use std::sync::atomic::{AtomicU32, Ordering};
use std::collections::HashMap;
use parking_lot::RwLock;
use tokio::time::{Duration, Instant};

use crate::crdt::{DocumentManager, AwarenessManager, DocumentPersistence};
use crate::error::Result;
use crate::state::AppState;

/// Yjs sync message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum YjsMessage {
    /// Step 1: Client sends sync request with their state vector
    SyncStep1 {
        document_id: Uuid,
        state_vector: String, // Base64 encoded
    },
    /// Step 2: Server replies with missing updates and requests client's updates
    SyncStep2 {
        document_id: Uuid,
        update: String,       // Base64 encoded
        state_vector: String, // Base64 encoded
    },
    /// Update: Client or server sends document updates
    Update {
        document_id: Uuid,
        update: String, // Base64 encoded
    },
    /// Awareness update
    Awareness {
        document_id: Uuid,
        update: serde_json::Value,
    },
}

/// Manages Yjs synchronization over Socket.IO
pub struct YjsSyncManager {
    document_manager: Arc<DocumentManager>,
    awareness_manager: Arc<AwarenessManager>,
    document_persistence: Arc<DocumentPersistence>,
    app_state: Arc<AppState>,
    update_counters: Arc<RwLock<HashMap<Uuid, Arc<AtomicU32>>>>,
    last_save_times: Arc<RwLock<HashMap<Uuid, Instant>>>,
}

impl YjsSyncManager {
    pub fn new(
        document_manager: Arc<DocumentManager>,
        awareness_manager: Arc<AwarenessManager>,
        document_persistence: Arc<DocumentPersistence>,
        app_state: Arc<AppState>,
    ) -> Self {
        Self {
            document_manager,
            awareness_manager,
            document_persistence,
            app_state,
            update_counters: Arc::new(RwLock::new(HashMap::new())),
            last_save_times: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Send initial state to a newly connected client
    pub async fn send_initial_state(
        &self,
        socket: &SocketRef,
        document_id: Uuid,
    ) -> Result<()> {
        // Get or create document
        let doc = self.document_manager.get_or_create(document_id);
        
        // Send current document state
        let state = {
            let doc = doc.read();
            doc.get_state_as_update()?
        };

        socket.emit("yjs:sync", YjsMessage::Update {
            document_id,
            update: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &state),
        })?;

        // Send awareness state
        let awareness = self.awareness_manager.get_or_create(document_id);
        socket.emit("yjs:awareness", serde_json::json!({
            "type": "awareness",
            "data": awareness.to_json()
        }))?;

        Ok(())
    }

    /// Handle incoming sync messages
    pub async fn handle_sync_message(
        &self,
        socket: &SocketRef,
        message: YjsMessage,
    ) -> Result<()> {
        match message {
            YjsMessage::SyncStep1 { document_id, state_vector } => {
                self.handle_sync_step1(socket, document_id, &state_vector).await
            }
            YjsMessage::SyncStep2 { document_id, update, state_vector } => {
                self.handle_sync_step2(socket, document_id, &update, &state_vector).await
            }
            YjsMessage::Update { document_id, update } => {
                self.handle_update(socket, document_id, &update).await
            }
            YjsMessage::Awareness { document_id, update } => {
                self.handle_awareness(socket, document_id, update).await
            }
        }
    }

    /// Handle sync step 1: Client sends their state vector
    async fn handle_sync_step1(
        &self,
        socket: &SocketRef,
        document_id: Uuid,
        state_vector_b64: &str,
    ) -> Result<()> {

        // Decode client's state vector
        let client_sv = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            state_vector_b64
        )?;

        // Load document from persistence if not in cache
        let doc = if let Some(doc) = self.document_manager.get(&document_id) {
            doc
        } else {
            // Try to load from database
            if let Some(loaded_doc) = self.document_persistence.load_document(document_id).await? {
                let doc_arc = self.document_manager.get_or_create(document_id);
                {
                    let mut cached_doc = doc_arc.write();
                    *cached_doc = loaded_doc;
                }
                doc_arc
            } else {
                // Create new document if it doesn't exist
                self.document_manager.get_or_create(document_id)
            }
        };
        
        // Get updates the client is missing
        let (update, server_sv) = {
            let doc = doc.read();
            let update = doc.get_update_since(&client_sv)?;
            let sv = doc.get_state_vector();
            (update, sv)
        };

        

        // Send sync step 2 response
        socket.emit("yjs:sync", YjsMessage::SyncStep2 {
            document_id,
            update: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &update),
            state_vector: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &server_sv),
        })?;

        Ok(())
    }

    /// Handle sync step 2: Process client's update and server's state vector
    async fn handle_sync_step2(
        &self,
        socket: &SocketRef,
        document_id: Uuid,
        update_b64: &str,
        _state_vector_b64: &str,
    ) -> Result<()> {

        // Decode and apply client's update
        let update = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            update_b64
        )?;

        if !update.is_empty() {
            self.apply_and_broadcast_update(socket, document_id, &update).await?;
        }

        Ok(())
    }

    /// Handle document update
    async fn handle_update(
        &self,
        socket: &SocketRef,
        document_id: Uuid,
        update_b64: &str,
    ) -> Result<()> {

        let update = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            update_b64
        )?;

        self.apply_and_broadcast_update(socket, document_id, &update).await
    }

    /// Apply update and broadcast to other clients
    async fn apply_and_broadcast_update(
        &self,
        socket: &SocketRef,
        document_id: Uuid,
        update: &[u8],
    ) -> Result<()> {
        // Apply update to document
        let doc = self.document_manager.get_or_create(document_id);
        {
            let mut doc = doc.write();
            doc.apply_update(update)?;
        }

        // Broadcast to other clients in the room
        let room_name = format!("doc:{}", document_id);
        socket.to(room_name).emit("yjs:sync", YjsMessage::Update {
            document_id,
            update: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, update),
        })?;

        // Save update to database for persistence
        if let Err(e) = self.document_persistence.save_update_auto(document_id, update).await {
            error!("Failed to persist update for document {}: {}", document_id, e);
            
            // Notify the client that sent the update about the persistence failure
            socket.emit("sync-error", serde_json::json!({
                "error": "Failed to persist document changes",
                "message": format!("Update could not be saved: {}", e),
                "document_id": document_id
            })).ok();
            
            // Continue despite persistence failure to maintain real-time collaboration
        }

        // Check if we should save based on update count or time
        let should_save = {
            let mut counters = self.update_counters.write();
            let counter = counters.entry(document_id)
                .or_insert_with(|| Arc::new(AtomicU32::new(0)));
            let count = counter.fetch_add(1, Ordering::Relaxed);
            
            // Check time-based save (every 30 seconds)
            let mut save_times = self.last_save_times.write();
            let last_save = save_times.entry(document_id).or_insert(Instant::now());
            let time_elapsed = last_save.elapsed();
            
            let should_save_by_time = time_elapsed >= Duration::from_secs(10); // Reduced from 30s to 10s
            let should_save_by_count = count >= 3; // Reduced from 5 to 3 updates
            let should_save_by_size = update.len() > 100; // Reduced from 500 to 100 bytes
            
            if should_save_by_time || should_save_by_count || should_save_by_size {
                *last_save = Instant::now();
                if should_save_by_count {
                    // Reset counter
                    counter.store(0, Ordering::Relaxed);
                }
                true
            } else {
                false
            }
        };
        
        if should_save {
            // Save document content to file in background
            let doc_manager = self.document_manager.clone();
            let doc_persistence = self.document_persistence.clone();
            let app_state = self.app_state.clone();
            
            tokio::spawn(async move {
                if let Err(e) = Self::save_document_to_file(document_id, &doc_manager, &doc_persistence, &app_state).await {
                    error!("Failed to save document {} to file: {}", document_id, e);
                }
            });
        }

        Ok(())
    }
    
    /// Save document content to file
    async fn save_document_to_file(
        document_id: Uuid,
        document_manager: &Arc<DocumentManager>,
        document_persistence: &Arc<DocumentPersistence>,
        app_state: &Arc<AppState>,
    ) -> Result<()> {
        // Get document content from CRDT
        if let Some(doc_arc) = document_manager.get(&document_id) {
            // Get content and create a temporary document for persistence
            let (content, temp_doc) = {
                let doc = doc_arc.read();
                let content = doc.get_content()?;
                let state = doc.get_state_as_update()?;
                let temp_doc = crate::crdt::CrdtDocument::from_state(document_id, &state)?;
                (content, temp_doc)
            };
            
            // Save current state to database
            document_persistence.sync_to_documents_table(&temp_doc).await?;
            
            info!("Saved document {} content to database ({} chars)", document_id, content.len());
            
            // Also save to filesystem
            if let Ok(Some(document)) = app_state.document_repository.get_by_id(document_id).await {
                let document_service = crate::services::document::DocumentService::new(
                    app_state.document_repository.clone(),
                    app_state.config.upload_dir.clone().into(),
                    app_state.crdt_service.clone(),
                );
                
                match document_service.save_to_file_with_content(&document, &content).await {
                    Ok(_) => {
                        info!("Successfully saved document {} to file ({} chars, title: {})", 
                              document_id, content.len(), document.title);
                    }
                    Err(e) => {
                        error!("Failed to save document {} to file after retries: {} (title: {}, content length: {})", 
                               document_id, e, document.title, content.len());
                        // Log content preview for debugging
                        let preview = content.chars().take(100).collect::<String>();
                        error!("Content preview: {}...", preview);
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Handle awareness update (JSON format)
    async fn handle_awareness(
        &self,
        socket: &SocketRef,
        document_id: Uuid,
        update: serde_json::Value,
    ) -> Result<()> {

        // Broadcast awareness update to other clients
        let room_name = format!("doc:{}", document_id);
        socket.to(room_name).emit("yjs:awareness", serde_json::json!({
            "type": "awareness",
            "data": update,
            "from": socket.id.to_string()
        }))?;

        Ok(())
    }
    
    /// Handle awareness update (binary y-protocols format)
    pub async fn handle_awareness_binary(
        &self,
        socket: &SocketRef,
        data: Vec<u8>,
    ) -> Result<()> {
        tracing::debug!("[handle_awareness_binary] Received awareness update from socket {}, size: {} bytes", 
              socket.id, data.len());
        
        // The awareness protocol sends updates as binary data
        // We need to figure out which document this is for
        // For now, we'll broadcast to all documents the client is connected to
        
        // Get documents this socket is connected to from connection tracker
        // Since we don't have direct access to connection tracker here,
        // we'll need to parse the awareness data to extract document info
        
        // For now, just broadcast the raw awareness data to all rooms the socket is in
        // This is a simplified approach - in production you'd want to properly
        // decode the awareness protocol to understand which document it's for
        
        // Get all rooms this socket is in
        let rooms = socket.rooms().unwrap_or_default();
        
        let mut broadcasted_to = Vec::new();
        
        for room in rooms.iter() {
            let room_str = room.to_string();
            if room_str.starts_with("doc:") {
                // Broadcast awareness update to other clients in the room
                // Send as base64 encoded string to avoid serialization issues
                let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data);
                socket.to(room.clone()).emit("yjs:awareness", encoded)?;
                broadcasted_to.push(room_str);
            }
        }
        
        if !broadcasted_to.is_empty() {
            tracing::debug!("[handle_awareness_binary] Broadcasted awareness to rooms: {:?}", broadcasted_to);
        }
        
        Ok(())
    }
}

/// Helper to create Yjs sync protocol messages
pub mod protocol {
    pub const SYNC_STEP_1: u8 = 0;
    pub const SYNC_STEP_2: u8 = 1;
    pub const UPDATE: u8 = 2;

    /// Create a sync step 1 message
    pub fn create_sync_step1(state_vector: &[u8]) -> Vec<u8> {
        let mut msg = vec![SYNC_STEP_1];
        msg.extend_from_slice(state_vector);
        msg
    }

    /// Create a sync step 2 message
    pub fn create_sync_step2(update: &[u8], state_vector: &[u8]) -> Vec<u8> {
        let mut msg = vec![SYNC_STEP_2];
        msg.extend_from_slice(&(update.len() as u32).to_be_bytes());
        msg.extend_from_slice(update);
        msg.extend_from_slice(state_vector);
        msg
    }

    /// Create an update message
    pub fn create_update(update: &[u8]) -> Vec<u8> {
        let mut msg = vec![UPDATE];
        msg.extend_from_slice(update);
        msg
    }
}