use socketioxide::{extract::{SocketRef, Data}, SocketIo};
use std::sync::Arc;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use tracing::{error};

use crate::state::AppState;
use crate::socketio::crdt_sync::{YjsSyncManager, YjsMessage};
use crate::socketio::connection_tracker::ConnectionTracker;
use crate::crdt::{UserPresence, CursorPosition, SelectionRange};
use crate::entities::share::Permission;
use crate::middleware::permission::check_any_resource_permission;

#[derive(Debug, Deserialize)]
struct JoinDocumentRequest {
    document_id: Uuid,
    #[serde(rename = "shareToken")]
    share_token: Option<String>,
    auth_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LeaveDocumentRequest {
    document_id: Uuid,
}

#[derive(Debug, Deserialize)]
struct CursorUpdateRequest {
    document_id: Uuid,
    cursor: Option<CursorPosition>,
}

#[derive(Debug, Deserialize)]
struct SelectionUpdateRequest {
    document_id: Uuid,
    selection: Option<SelectionRange>,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

pub fn setup_handlers(io: SocketIo, state: Arc<AppState>) {
    let sync_manager = Arc::new(YjsSyncManager::new(
        state.document_manager.clone(),
        state.awareness_manager.clone(),
        state.document_persistence.clone(),
        state.clone(),
    ));
    
    let connection_tracker = Arc::new(ConnectionTracker::new());

    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();
        let sync_manager = sync_manager.clone();
        let connection_tracker = connection_tracker.clone();
        
        async move {

            // Join document room
            {
                let state = state.clone();
                let sync_manager = sync_manager.clone();
                let connection_tracker = connection_tracker.clone();
                
                socket.on("join_document", move |socket: SocketRef, Data::<JoinDocumentRequest>(data)| {
                    let state = state.clone();
                    let _sync_manager = sync_manager.clone();
                    let connection_tracker = connection_tracker.clone();
                    
                    async move {
                        tracing::info!("[SocketIO] Join document request: doc_id={}, share_token={:?}, auth_token={}", 
                                     data.document_id, data.share_token.is_some(), data.auth_token.is_some());
                        
                        // Try to authenticate with JWT token if provided
                        let mut user_id = None;
                        let mut user_email = None;
                        
                        if let Some(token) = &data.auth_token {
                            // Verify JWT token
                            match crate::utils::jwt::verify_token(token, &state.config.jwt_secret) {
                                Ok(claims) => {
                                    user_id = Some(claims.sub);
                                    user_email = Some(claims.email);
                                    tracing::info!("[SocketIO] JWT authentication successful: user_id={}", claims.sub);
                                }
                                Err(e) => {
                                    tracing::warn!("[SocketIO] JWT verification failed: {}", e);
                                }
                            }
                        } else {
                            tracing::info!("[SocketIO] No auth token provided");
                        }
                        
                        // Check permissions for any resource type (document or scrap) with optional auth and share token
                        tracing::info!("[SocketIO] Checking permissions: user_id={:?}, share_token={:?}", 
                                     user_id, data.share_token.is_some());
                        
                        let permission_check = check_any_resource_permission(
                            &state,
                            data.document_id,
                            user_id,
                            data.share_token.clone(),
                            Permission::View
                        ).await;
                        
                        if let Err(e) = permission_check {
                            tracing::error!("[SocketIO] Permission check error: {}", e);
                            socket.emit("error", ErrorResponse {
                                error: format!("Permission denied: {}", e)
                            }).ok();
                            return;
                        }
                        
                        let check = permission_check.unwrap();
                        tracing::info!("[SocketIO] Permission check result: has_access={}, is_share_link={}", 
                                     check.has_access, check.is_share_link);
                        
                        if !check.has_access {
                            tracing::warn!("[SocketIO] Access denied for document: {}", data.document_id);
                            socket.emit("error", ErrorResponse {
                                error: "Access denied to resource".to_string()
                            }).ok();
                            return;
                        }
                        
                        // If using share link, create a temporary user
                        let (final_user_id, final_user_email) = if check.is_share_link {
                            (
                                Uuid::new_v4(),
                                format!("guest-{}@share.link", socket.id)
                            )
                        } else {
                            (
                                user_id.unwrap_or_else(Uuid::new_v4),
                                user_email.unwrap_or_else(|| format!("user-{}@example.com", socket.id))
                            )
                        };

                        // Check if already in the room
                        let room_name = format!("doc:{}", data.document_id);
                        
                        // Track the connection first to check if already joined
                        let already_joined = connection_tracker.is_socket_in_document(&socket.id.to_string(), data.document_id);
                        
                        if already_joined {
                            // Don't send joined-document again to prevent loops
                            return;
                        }
                        
                        // Join the document room
                        socket.join(room_name.clone()).ok();
                        
                        // Track the connection
                        connection_tracker.join_document(&socket.id.to_string(), data.document_id);

                        // Track user info in awareness state
                        // User info is managed through awareness now

                        // Initialize user presence
                        let presence = UserPresence {
                            user_id: final_user_id,
                            name: final_user_email.clone(), // TODO: Use actual name
                            color: generate_user_color(&final_user_id.to_string()),
                            cursor: None,
                            selection: None,
                            last_seen: chrono::Utc::now(),
                        };

                        let awareness = state.awareness_manager.get_or_create(data.document_id);
                        awareness.set_user_presence(socket.id.to_string(), presence).ok();

                        // Notify client of successful join
                        socket.emit("joined-document", serde_json::json!({
                            "document_id": data.document_id.to_string()
                        })).ok();

                        // Send user count update to all clients in the room (including the new user)
                        let user_count = connection_tracker.get_document_sockets(data.document_id).len();
                        tracing::info!("[SocketIO] Sending user count update: {} users in document {}", user_count, data.document_id);
                        
                        let count_update = serde_json::json!({
                            "count": user_count
                        });
                        
                        // Send to existing users in the room
                        socket.to(room_name.clone()).emit("user_count_update", &count_update).ok();
                        // Send to the new user
                        socket.emit("user_count_update", &count_update).ok();

                        // Load document from database if it exists
                        if let Err(e) = state.crdt_service.load_or_create_document(data.document_id).await {
                            error!("Failed to load document: {}", e);
                        }
                        
                        // Don't send initial state immediately - let client request it via sync protocol
                        // This prevents the "Unexpected end of array" error when client isn't ready yet

                        // Broadcast user joined
                        socket.to(room_name).emit("user_joined", &awareness.to_json()).ok();

                    }
                });
            }

            // Leave document room
            {
                let state = state.clone();
                let connection_tracker = connection_tracker.clone();
                
                socket.on("leave_document", move |socket: SocketRef, Data::<LeaveDocumentRequest>(data)| {
                    let state = state.clone();
                    let connection_tracker = connection_tracker.clone();
                    
                    async move {
                        let room_name = format!("doc:{}", data.document_id);
                        socket.leave(room_name.clone()).ok();
                        
                        // Update connection tracking
                        connection_tracker.leave_document(&socket.id.to_string(), data.document_id);

                        // Remove user presence
                        let awareness = state.awareness_manager.get_or_create(data.document_id);
                        awareness.remove_user(&socket.id.to_string());
                        
                        // Check if document can be evicted from cache
                        if connection_tracker.is_document_empty(data.document_id) {
                            // Save CRDT state to database before evicting
                            if let Err(e) = state.crdt_service.save_document(data.document_id).await {
                                error!("Failed to save document {}: {}", data.document_id, e);
                            }
                            
                            // Also save to file
                            if let Ok(Some(document)) = state.document_repository.get_by_id(data.document_id).await {
                                if let Err(e) = state.document_service.save_to_file(&document).await {
                                    error!("Failed to save document {} to file: {}", data.document_id, e);
                                }
                            }
                            // Optionally evict from cache to save memory
                            // state.crdt_service.evict_from_cache(&data.document_id);
                        }

                        // User info is managed through awareness

                        // Broadcast user left
                        socket.to(room_name.clone()).emit("user_left", serde_json::json!({
                            "client_id": socket.id.to_string()
                        })).ok();

                        // Send updated user count to remaining clients
                        let user_count = connection_tracker.get_document_sockets(data.document_id).len();
                        tracing::info!("[SocketIO] User left, sending user count update: {} users remaining in document {}", user_count, data.document_id);
                        
                        socket.to(room_name).emit("user_count_update", serde_json::json!({
                            "count": user_count
                        })).ok();

                    }
                });
            }

            // Handle Yjs sync messages
            {
                let sync_manager = sync_manager.clone();
                
                socket.on("yjs:sync", move |socket: SocketRef, Data::<YjsMessage>(msg)| {
                    let sync_manager = sync_manager.clone();
                    
                    async move {
                        if let Err(e) = sync_manager.handle_sync_message(&socket, msg).await {
                            error!("Failed to handle sync message: {}", e);
                        }
                    }
                });
            }

            // Handle cursor updates
            {
                let state = state.clone();
                
                socket.on("cursor_update", move |socket: SocketRef, Data::<CursorUpdateRequest>(data)| {
                    let state = state.clone();
                    
                    async move {
                        let awareness = state.awareness_manager.get_or_create(data.document_id);
                        let cursor = data.cursor.clone();
                        awareness.update_cursor(&socket.id.to_string(), cursor).ok();

                        let room_name = format!("doc:{}", data.document_id);
                        socket.to(room_name).emit("cursor_update", serde_json::json!({
                            "client_id": socket.id.to_string(),
                            "cursor": data.cursor
                        })).ok();
                    }
                });
            }

            // Handle selection updates
            {
                let state = state.clone();
                
                socket.on("selection_update", move |socket: SocketRef, Data::<SelectionUpdateRequest>(data)| {
                    let state = state.clone();
                    
                    async move {
                        let awareness = state.awareness_manager.get_or_create(data.document_id);
                        let selection = data.selection.clone();
                        awareness.update_selection(&socket.id.to_string(), selection).ok();

                        let room_name = format!("doc:{}", data.document_id);
                        socket.to(room_name).emit("selection_update", serde_json::json!({
                            "client_id": socket.id.to_string(),
                            "selection": data.selection
                        })).ok();
                    }
                });
            }

            // Handle scrap post events
            {
                let state_clone = state.clone();
                socket.on("scrap_post_added", move |socket: SocketRef, Data::<serde_json::Value>(data)| {
                    let _state = state_clone.clone();
                    
                    async move {
                        if let Some(document_id) = data.get("document_id").and_then(|v| v.as_str()) {
                            if let Ok(doc_id) = document_id.parse::<Uuid>() {
                                let room_name = format!("doc:{}", doc_id);
                                socket.to(room_name).emit("scrap_post_added", data).ok();
                            }
                        }
                    }
                });
            }
            
            {
                let state_clone = state.clone();
                socket.on("scrap_post_updated", move |socket: SocketRef, Data::<serde_json::Value>(data)| {
                    let _state = state_clone.clone();
                    
                    async move {
                        if let Some(document_id) = data.get("document_id").and_then(|v| v.as_str()) {
                            if let Ok(doc_id) = document_id.parse::<Uuid>() {
                                let room_name = format!("doc:{}", doc_id);
                                socket.to(room_name).emit("scrap_post_updated", data).ok();
                            }
                        }
                    }
                });
            }
            
            {
                let state_clone = state.clone();
                socket.on("scrap_post_deleted", move |socket: SocketRef, Data::<serde_json::Value>(data)| {
                    let _state = state_clone.clone();
                    
                    async move {
                        if let Some(document_id) = data.get("document_id").and_then(|v| v.as_str()) {
                            if let Ok(doc_id) = document_id.parse::<Uuid>() {
                                let room_name = format!("doc:{}", doc_id);
                                socket.to(room_name).emit("scrap_post_deleted", data).ok();
                            }
                        }
                    }
                });
            }

            // Handle Yjs awareness updates
            {
                let sync_manager = sync_manager.clone();
                
                socket.on("yjs:awareness", move |socket: SocketRef, Data::<serde_json::Value>(data)| {
                    let sync_manager = sync_manager.clone();
                    
                    async move {
                        // Debug: Log the received data format
                        tracing::debug!("Received yjs:awareness data type: {}", 
                            if data.is_array() { "array" } 
                            else if data.is_object() { "object" } 
                            else if data.is_string() { "string" }
                            else { "unknown" }
                        );
                        
                        // Try to extract binary data from various formats
                        let binary_data = if let Some(array) = data.as_array() {
                            // If it's an array of numbers, convert to Vec<u8>
                            tracing::info!("Processing array of size: {}", array.len());
                            array.iter()
                                .filter_map(|v| v.as_u64().map(|n| n as u8))
                                .collect::<Vec<u8>>()
                        } else if let Some(obj) = data.as_object() {
                            // Check if it's a Uint8Array-like object with data property
                            if let Some(data_array) = obj.get("data").and_then(|v| v.as_array()) {
                                data_array.iter()
                                    .filter_map(|v| v.as_u64().map(|n| n as u8))
                                    .collect::<Vec<u8>>()
                            } else {
                                error!("Unknown awareness data format: {:?}", obj);
                                vec![]
                            }
                        } else if let Some(s) = data.as_str() {
                            // If it's a base64 string, decode it
                            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, s)
                                .unwrap_or_else(|e| {
                                    error!("Failed to decode base64 awareness data: {}", e);
                                    vec![]
                                })
                        } else {
                            error!("Unknown awareness data type: {:?}", data);
                            vec![]
                        };
                        
                        if !binary_data.is_empty() {
                            if let Err(e) = sync_manager.handle_awareness_binary(&socket, binary_data).await {
                                error!("Failed to handle awareness message: {}", e);
                            }
                        }
                    }
                });
            }


            // Handle disconnect
            {
                let state = state.clone();
                let connection_tracker = connection_tracker.clone();
                
                socket.on_disconnect(move |socket: SocketRef| {
                    let state = state.clone();
                    let connection_tracker = connection_tracker.clone();
                    
                    async move {

                        // Get all documents this socket was connected to
                        let documents = connection_tracker.remove_socket(&socket.id.to_string());
                        
                        // Clean up user from all documents
                        for doc_id in documents {
                            // Remove from awareness
                            let awareness = state.awareness_manager.get_or_create(doc_id);
                            awareness.remove_user(&socket.id.to_string());
                            
                            // Broadcast user left to remaining users
                            let room_name = format!("doc:{}", doc_id);
                            socket.to(room_name.clone()).emit("user_left", serde_json::json!({
                                "client_id": socket.id.to_string()
                            })).ok();

                            // Send updated user count to remaining clients
                            let user_count = connection_tracker.get_document_sockets(doc_id).len();
                            tracing::info!("[SocketIO] User disconnected, sending user count update: {} users remaining in document {}", user_count, doc_id);
                            
                            socket.to(room_name).emit("user_count_update", serde_json::json!({
                                "count": user_count
                            })).ok();
                            
                            // Always save on disconnect to ensure no data loss
                            // Save CRDT state to database
                            if let Err(e) = state.crdt_service.save_document(doc_id).await {
                                error!("Failed to save document {} on disconnect: {}", doc_id, e);
                            }
                            
                            // Also save to file to ensure all content is persisted
                            if let Ok(Some(document)) = state.document_repository.get_by_id(doc_id).await {
                                if let Err(e) = state.document_service.save_to_file(&document).await {
                                    error!("Failed to save document {} to file on disconnect: {}", doc_id, e);
                                } else {
                                    tracing::info!("Saved document {} to file on disconnect (remaining users: {})", 
                                                 doc_id, 
                                                 if connection_tracker.is_document_empty(doc_id) { 0 } else { 1 });
                                }
                            }
                            
                            // Check if document can be evicted
                            if connection_tracker.is_document_empty(doc_id) {
                                // Optionally evict from cache to save memory
                                // state.crdt_service.evict_from_cache(&doc_id);
                            }
                        }
                    }
                });
            }
        }
    });
}

fn generate_user_color(user_id: &str) -> String {
    // Generate a consistent color based on user ID
    let hash = user_id.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32));
    let hue = (hash % 360) as f32;
    format!("hsl({}, 70%, 50%)", hue)
}