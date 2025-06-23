use axum::{
    extract::{State, Extension, Path, Query},
    Json,
    Router,
    routing::{get, post, delete},
    middleware::from_fn_with_state,
    response::{IntoResponse, Response},
    http::{header, StatusCode},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::collections::HashMap;
use std::io::{Cursor, Write};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use zip::write::FileOptions;
use zip::ZipWriter;
use bytes::Bytes;
use crate::{
    error::Result,
    state::AppState,
    middleware::{auth::{auth_middleware, AuthUser}, optional_auth::{optional_auth_middleware, OptionalAuthUser}, permission::check_document_permission},
    db::models::Document,
    crdt::serialization,
    entities::share::Permission,
};

#[derive(Debug, Deserialize)]
pub struct CreateDocumentRequest {
    pub title: String,
    pub content: Option<String>,
    #[serde(rename = "type", default = "default_document_type")]
    pub doc_type: String,
    pub parent_id: Option<Uuid>,
}

fn default_document_type() -> String {
    "document".to_string()
}

#[derive(Debug, Deserialize)]
pub struct UpdateDocumentRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct DocumentResponse {
    pub id: String,
    pub owner_id: String,
    pub title: String,
    pub r#type: String,
    pub parent_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Document> for DocumentResponse {
    fn from(doc: Document) -> Self {
        Self {
            id: doc.id.to_string(),
            owner_id: doc.owner_id.to_string(),
            title: doc.title,
            r#type: doc.r#type,
            parent_id: doc.parent_id.map(|id| id.to_string()),
            created_at: doc.created_at.to_rfc3339(),
            updated_at: doc.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct DocumentContentResponse {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct DocumentStateResponse {
    pub state: String, // Base64 encoded CRDT state
}

#[derive(Debug, Deserialize)]
pub struct DocumentUpdatesRequest {
    pub since: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct DocumentUpdatesResponse {
    pub updates: Vec<String>, // Base64 encoded updates
}

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Routes requiring auth
        .route("/", get(list_documents).post(create_document))
        .route("/:id", delete(delete_document))
        .route("/:id/file-path", get(get_document_file_path))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        // Routes supporting optional auth (for share tokens)
        .route("/:id", get(get_document_with_share).put(update_document_with_share))
        .route("/:id/content", get(get_document_content_with_share))
        .route("/:id/state", get(get_document_state_with_share))
        .route("/:id/updates", post(get_document_updates_with_share))
        .route("/:id/download", get(download_document_with_share))
        .layer(from_fn_with_state(state.clone(), optional_auth_middleware))
        .with_state(state)
}

async fn list_documents(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<DocumentResponse>>> {
    let documents = state.document_service.list_documents(auth_user.user_id).await?;
    let response: Vec<DocumentResponse> = documents.into_iter().map(Into::into).collect();
    
    Ok(Json(response))
}

async fn create_document(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateDocumentRequest>,
) -> Result<Json<DocumentResponse>> {
    let document = state.document_service.create_document(
        auth_user.user_id,
        &req.title,
        req.content.as_deref(),
        &req.doc_type,
        req.parent_id,
    ).await?;
    
    // Initialize CRDT with content if provided
    if let Some(ref content) = req.content {
        state.crdt_service.set_document_content(document.id, content).await?;
        
        // Re-save document to file with content
        state.document_service.save_to_file_with_content(&document, content).await?;
    }
    
    Ok(Json(document.into()))
}

async fn get_document(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentResponse>> {
    let document = state.document_service.get_document(id, auth_user.user_id).await?;
    
    Ok(Json(document.into()))
}

async fn get_document_with_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<DocumentResponse>> {
    let share_token = params.get("token").cloned();
    let user_id = auth_user.user_id;
    
    // Check permissions with optional auth and share token
    let check = check_document_permission(
        &state,
        id,
        user_id,
        share_token,
        Permission::View
    ).await?;
    
    if !check.has_access {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Get document directly from repository since we've already checked permissions
    let document = state.document_repository
        .get_by_id(id)
        .await?
        .ok_or_else(|| crate::error::Error::NotFound("Document not found".to_string()))?;
    
    Ok(Json(document.into()))
}

// GET /api/documents/:id/file-path
async fn get_document_file_path(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get document and check ownership
    let document = state.document_repository
        .get_by_id(id)
        .await?
        .ok_or_else(|| crate::error::Error::NotFound("Document not found".to_string()))?;
    
    // Check if user owns the document
    if document.owner_id != auth_user.user_id {
        return Err(crate::error::Error::Forbidden);
    }
    
    Ok(Json(serde_json::json!({
        "file_path": document.file_path
    })))
}

async fn update_document(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateDocumentRequest>,
) -> Result<Json<DocumentResponse>> {
    let document = state.document_service.update_document(
        id,
        auth_user.user_id,
        req.title.as_deref(),
        req.content.as_deref(),
        req.parent_id,
    ).await?;
    
    // Update CRDT content if provided
    if let Some(ref content) = req.content {
        tracing::info!("Updating document {} with content: {} chars", document.id, content.len());
        state.crdt_service.set_document_content(document.id, content).await?;
        
        // Save updated content to file
        tracing::info!("Saving document {} to file", document.id);
        state.document_service.save_to_file_with_content(&document, content).await?;
    } else {
        tracing::info!("No content provided for document {} update", document.id);
    }
    
    Ok(Json(document.into()))
}

async fn update_document_with_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    Json(req): Json<UpdateDocumentRequest>,
) -> Result<Json<DocumentResponse>> {
    let share_token = params.get("token").cloned();
    let user_id = auth_user.user_id;
    
    // Check permissions with optional auth and share token
    let check = check_document_permission(
        &state,
        id,
        user_id,
        share_token,
        Permission::Edit  // Require edit permission for updates
    ).await?;
    
    if !check.has_access {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Get the document owner for the update operation
    let document = state.document_repository
        .get_by_id(id)
        .await?
        .ok_or_else(|| crate::error::Error::NotFound("Document not found".to_string()))?;
    
    // Use the document owner ID for the update (since share links don't have a user ID)
    let update_user_id = user_id.unwrap_or(document.owner_id);
    
    let updated_document = state.document_service.update_document(
        id,
        update_user_id,
        req.title.as_deref(),
        req.content.as_deref(),
        req.parent_id,
    ).await?;
    
    // Update CRDT content if provided
    if let Some(ref content) = req.content {
        tracing::info!("Updating document {} with content via share link: {} chars", updated_document.id, content.len());
        state.crdt_service.set_document_content(updated_document.id, content).await?;
        
        // Save updated content to file
        tracing::info!("Saving document {} to file via share link", updated_document.id);
        state.document_service.save_to_file_with_content(&updated_document, content).await?;
    } else {
        tracing::info!("No content provided for document {} update via share link", updated_document.id);
    }
    
    Ok(Json(updated_document.into()))
}

async fn delete_document(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<()> {
    state.document_service.delete_document(id, auth_user.user_id).await?;
    
    // Also remove from CRDT cache
    state.crdt_service.evict_from_cache(&id);
    
    Ok(())
}

async fn get_document_content(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentContentResponse>> {
    // Check permissions
    state.document_service.get_document(id, auth_user.user_id).await?;
    
    // Get content from CRDT
    let content = state.crdt_service.get_document_content(id).await?;
    
    Ok(Json(DocumentContentResponse { content }))
}

async fn get_document_content_with_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<DocumentContentResponse>> {
    let share_token = params.get("token").cloned();
    let user_id = auth_user.user_id;
    
    // Check permissions with optional auth and share token
    let check = check_document_permission(
        &state,
        id,
        user_id,
        share_token,
        Permission::View
    ).await?;
    
    if !check.has_access {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Get content from CRDT
    let content = state.crdt_service.get_document_content(id).await?;
    
    Ok(Json(DocumentContentResponse { content }))
}

async fn get_document_state(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentStateResponse>> {
    // Check permissions
    state.document_service.get_document(id, auth_user.user_id).await?;
    
    // Get CRDT state
    let doc = state.crdt_service.load_or_create_document(id).await?;
    let state_bytes = {
        let doc = doc.read();
        doc.get_state_as_update()?
    };
    
    Ok(Json(DocumentStateResponse {
        state: serialization::update_to_base64(&state_bytes),
    }))
}

async fn get_document_state_with_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<DocumentStateResponse>> {
    let share_token = params.get("token").cloned();
    let user_id = auth_user.user_id;
    
    // Check permissions with optional auth and share token
    let check = check_document_permission(
        &state,
        id,
        user_id,
        share_token,
        Permission::View
    ).await?;
    
    if !check.has_access {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Get CRDT state
    let doc = state.crdt_service.load_or_create_document(id).await?;
    let state_bytes = {
        let doc = doc.read();
        doc.get_state_as_update()?
    };
    
    Ok(Json(DocumentStateResponse {
        state: serialization::update_to_base64(&state_bytes),
    }))
}

async fn get_document_updates(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(req): Json<DocumentUpdatesRequest>,
) -> Result<Json<DocumentUpdatesResponse>> {
    // Check permissions
    state.document_service.get_document(id, auth_user.user_id).await?;
    
    // Get updates since timestamp
    let since = req.since.unwrap_or_else(|| Utc::now() - chrono::Duration::days(7));
    let updates = state.crdt_service.get_updates_since(id, since).await?;
    
    let updates_base64: Vec<String> = updates
        .into_iter()
        .map(|u| serialization::update_to_base64(&u))
        .collect();
    
    Ok(Json(DocumentUpdatesResponse {
        updates: updates_base64,
    }))
}

async fn get_document_updates_with_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    Json(req): Json<DocumentUpdatesRequest>,
) -> Result<Json<DocumentUpdatesResponse>> {
    let share_token = params.get("token").cloned();
    let user_id = auth_user.user_id;
    
    // Check permissions with optional auth and share token
    let check = check_document_permission(
        &state,
        id,
        user_id,
        share_token,
        Permission::View
    ).await?;
    
    if !check.has_access {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Get updates since timestamp
    let since = req.since.unwrap_or_else(|| Utc::now() - chrono::Duration::days(7));
    let updates = state.crdt_service.get_updates_since(id, since).await?;
    
    let updates_base64: Vec<String> = updates
        .into_iter()
        .map(|u| serialization::update_to_base64(&u))
        .collect();
    
    Ok(Json(DocumentUpdatesResponse {
        updates: updates_base64,
    }))
}
async fn download_document_with_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response> {
    let share_token = params.get("token").cloned();
    let user_id = auth_user.user_id;
    
    // Check permissions with optional auth and share token
    let check = check_document_permission(
        &state,
        id,
        user_id,
        share_token.clone(),
        Permission::View
    ).await?;
    
    if !check.has_access {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Get document
    let document = state.document_repository
        .get_by_id(id)
        .await?
        .ok_or_else(|| crate::error::Error::NotFound("Document not found".to_string()))?;
    
    // Get document content
    let content = state.crdt_service.get_document_content(id).await?;
    
    // Create ZIP in memory
    let mut zip_buffer = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut zip_buffer);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644);
        
        // Add the markdown content as the main file
        let markdown_filename = format!("{}.md", document.title.replace("/", "_"));
        zip.start_file(&markdown_filename, options)?;
        zip.write_all(content.as_bytes())?;
        
        // Get all attachments for this document - use the existing file_service from state
        let file_service = &state.file_service;
        
        // For listing files, we need to check access differently based on auth status
        let attachments = if let Some(user_id) = user_id {
            // Authenticated user - use their ID
            match file_service.list_by_document(id, user_id, 1000).await {
                Ok(files) => files,
                Err(_) => Vec::new(), // If error, just skip attachments
            }
        } else if share_token.is_some() {
            // Share token access - get files directly from repository
            match state.db_pool
                .acquire()
                .await
                .ok()
                .and_then(|mut conn| {
                    let query = sqlx::query_as::<_, crate::entities::file::Attachment>(
                        "SELECT * FROM attachments WHERE document_id = $1 LIMIT 1000"
                    )
                    .bind(id);
                    
                    tokio::task::block_in_place(|| {
                        tokio::runtime::Handle::current().block_on(query.fetch_all(&mut *conn))
                    }).ok()
                }) {
                Some(attachments) => attachments.into_iter().map(|a| crate::entities::file::FileResponse {
                    id: a.id,
                    filename: a.filename.clone(),
                    size: a.size_bytes,
                    mime_type: a.mime_type.clone(),
                    url: format!("./attachments/{}", a.filename),
                }).collect(),
                None => Vec::new(),
            }
        } else {
            Vec::new()
        };
        
        // Add each attachment to the ZIP
        if !attachments.is_empty() {
            // Create attachments directory in ZIP
            zip.add_directory("attachments", options)?;
            
            for attachment in attachments {
                // Try to read the file
                let file_result = if let Some(user_id) = user_id {
                    file_service.download(attachment.id, user_id).await
                } else if let Some(ref token) = share_token {
                    file_service.download_by_name_with_access_check(
                        &attachment.filename,
                        id,
                        None,
                        Some(token.clone())
                    ).await
                } else {
                    continue; // Skip if no access
                };
                
                if let Ok((_, file_data)) = file_result {
                    let file_path = format!("attachments/{}", attachment.filename);
                    zip.start_file(&file_path, options)?;
                    zip.write_all(&file_data)?;
                }
            }
        }
        
        zip.finish()?;
    }
    
    let zip_data = zip_buffer.into_inner();
    let zip_filename = format!("{}.zip", document.title.replace("/", "_"));
    
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/zip"),
            (
                header::CONTENT_DISPOSITION,
                &format!("attachment; filename=\"{}\"", zip_filename),
            ),
        ],
        Bytes::from(zip_data),
    ).into_response())
}
