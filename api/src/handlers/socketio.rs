use axum::{
    extract::{Path, State, Extension},
    response::Json,
    Router,
    routing::get,
    middleware::from_fn_with_state,
};
use uuid::Uuid;
use serde::Serialize;
use std::sync::Arc;

use crate::{
    error::Result,
    state::AppState,
    middleware::auth::{auth_middleware, AuthUser},
};

#[derive(Debug, Serialize)]
pub struct ActiveUser {
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub cursor: Option<CursorInfo>,
    pub selection: Option<crate::crdt::SelectionRange>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct CursorInfo {
    pub index: u32,
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Serialize)]
pub struct DocumentStats {
    pub active_users: usize,
    pub total_edits: u64,
    pub last_modified: chrono::DateTime<chrono::Utc>,
}


pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/documents/:id/active-users", get(get_active_users))
        .route("/documents/:id/stats", get(get_document_stats))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

/// Get active users for a document
pub async fn get_active_users(
    State(state): State<Arc<AppState>>,
    Path(document_id): Path<Uuid>,
    Extension(_auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ActiveUser>>> {
    // Get awareness state for the document
    let awareness = state.awareness_manager.get_or_create(document_id);
    let users = awareness.get_all_users();
    
    let active_users: Vec<ActiveUser> = users.into_iter()
        .map(|(_, presence)| ActiveUser {
            user_id: presence.user_id,
            name: presence.name,
            color: presence.color,
            cursor: presence.cursor.map(|c| CursorInfo {
                index: c.index,
                line: c.line,
                column: c.column,
            }),
            selection: presence.selection,
            last_seen: presence.last_seen,
        })
        .collect();
    
    Ok(Json(active_users))
}

/// Get document statistics
pub async fn get_document_stats(
    State(state): State<Arc<AppState>>,
    Path(document_id): Path<Uuid>,
    Extension(_auth_user): Extension<AuthUser>,
) -> Result<Json<DocumentStats>> {
    // Get awareness state for active users count
    let awareness = state.awareness_manager.get_or_create(document_id);
    let active_users = awareness.get_all_users().len();
    
    // Get document for last modified time
    let last_modified = if let Some(doc) = state.document_manager.get(&document_id) {
        doc.read().last_modified()
    } else {
        chrono::Utc::now()
    };
    
    // TODO: Get total edits from database when we implement update persistence
    let total_edits = 0;
    
    Ok(Json(DocumentStats {
        active_users,
        total_edits,
        last_modified,
    }))
}

