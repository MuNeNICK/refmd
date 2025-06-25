use axum::{
    extract::{State, Path, Query, Extension},
    Json,
    Router,
    routing::{get, post, delete},
    middleware::from_fn_with_state,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::{Error, Result},
    state::AppState,
    middleware::optional_auth::{OptionalAuthUser, optional_auth_middleware},
};

#[derive(Debug, Deserialize)]
pub struct PublishDocumentRequest {}

#[derive(Debug, Serialize)]
pub struct PublishDocumentResponse {
    pub public_url: String,
}

#[derive(Debug, Serialize)]
pub struct PublicDocumentResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub document_type: String,
    pub published_at: String,
    pub updated_at: String,
    pub author: AuthorInfo,
}

#[derive(Debug, Serialize)]
pub struct AuthorInfo {
    pub username: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct PublicDocumentListResponse {
    pub documents: Vec<PublicDocumentSummary>,
    pub total: usize,
}

#[derive(Debug, Serialize)]
pub struct PublicDocumentSummary {
    pub id: String,
    pub title: String,
    pub document_type: String,
    pub published_at: String,
    pub updated_at: String,
}


#[derive(Debug, Deserialize)]
pub struct PublicListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn routes(state: Arc<AppState>) -> Router {
    // Public routes (no auth required)
    Router::new()
        .route("/u/:username/:document_id", get(get_public_document))
        .route("/u/:username", get(list_user_public_documents))
        .with_state(state)
}

pub fn protected_routes(state: Arc<AppState>) -> Router {
    // Protected routes (require auth)
    Router::new()
        .route("/:id/publish", post(publish_document))
        .route("/:id/unpublish", delete(unpublish_document))
        .layer(from_fn_with_state(state.clone(), optional_auth_middleware))
        .with_state(state)
}

pub fn my_documents_routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/my-public-documents", get(list_my_public_documents))
        .layer(from_fn_with_state(state.clone(), optional_auth_middleware))
        .with_state(state)
}

/// Publish a document (make it publicly accessible)
async fn publish_document(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(document_id): Path<Uuid>,
    Json(_req): Json<PublishDocumentRequest>,
) -> Result<Json<PublishDocumentResponse>> {
    let user_id = auth_user.user_id.ok_or(Error::Unauthorized)?;
    
    // Publish the document
    state.public_document_service.publish_document(document_id, user_id).await?;
    
    // Get user info for URL generation
    let user = sqlx::query!(
        "SELECT username FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(state.db_pool.as_ref())
    .await?;
    
    let public_url = format!("/u/{}/{}", user.username, document_id);
    
    Ok(Json(PublishDocumentResponse {
        public_url,
    }))
}

/// Unpublish a document (make it private)
async fn unpublish_document(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(document_id): Path<Uuid>,
) -> Result<()> {
    let user_id = auth_user.user_id.ok_or(Error::Unauthorized)?;
    state.public_document_service.unpublish_document(document_id, user_id).await?;
    Ok(())
}



/// List current user's published documents
async fn list_my_public_documents(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
) -> Result<Json<PublicDocumentListResponse>> {
    let user_id = auth_user.user_id.ok_or(Error::Unauthorized)?;
    
    let documents = state.public_document_service.list_my_public_documents(user_id).await?;
    
    let response = PublicDocumentListResponse {
        total: documents.len(),
        documents: documents
            .into_iter()
            .map(|doc| PublicDocumentSummary {
                id: doc.id.to_string(),
                title: doc.title,
                document_type: doc.document_type,
                published_at: doc.published_at.to_rfc3339(),
                updated_at: doc.updated_at.to_rfc3339(),
            })
            .collect(),
    };
    
    Ok(Json(response))
}

/// Get a public document by username and document ID
async fn get_public_document(
    State(state): State<Arc<AppState>>,
    Path((username, document_id)): Path<(String, Uuid)>,
) -> Result<Json<PublicDocumentResponse>> {
    // Get document info
    let doc_info = state.public_document_service.get_public_document(&username, &document_id.to_string()).await?;
    
    let content = if doc_info.document_type == "scrap" {
        // For scraps, fetch posts and serialize them
        let posts = sqlx::query!(
            r#"
            SELECT id, content, created_at, updated_at, author_id
            FROM scrap_posts
            WHERE document_id = $1
            ORDER BY created_at ASC
            "#,
            doc_info.id
        )
        .fetch_all(state.db_pool.as_ref())
        .await?;
        
        // Convert posts to JSON format
        let posts_json: Vec<serde_json::Value> = posts.into_iter().map(|post| {
            serde_json::json!({
                "id": post.id,
                "content": post.content,
                "created_at": post.created_at.unwrap_or(chrono::Utc::now()).to_rfc3339(),
                "updated_at": post.updated_at.unwrap_or(chrono::Utc::now()).to_rfc3339(),
                "created_by": post.author_id,
            })
        }).collect();
        
        serde_json::json!({
            "posts": posts_json
        }).to_string()
    } else {
        // For documents, get content from CRDT service
        state.crdt_service.get_document_content(doc_info.id).await?
    };
    
    let response = PublicDocumentResponse {
        id: doc_info.id.to_string(),
        title: doc_info.title,
        content,
        document_type: doc_info.document_type,
        published_at: doc_info.published_at.to_rfc3339(),
        updated_at: doc_info.updated_at.to_rfc3339(),
        author: AuthorInfo {
            username: doc_info.owner_username,
            name: doc_info.owner_name,
        },
    };
    
    Ok(Json(response))
}

/// List all public documents by a user
async fn list_user_public_documents(
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
    Query(query): Query<PublicListQuery>,
) -> Result<Json<PublicDocumentListResponse>> {
    let limit = query.limit.unwrap_or(20).min(100); // Max 100 per page
    let offset = query.offset.unwrap_or(0);
    
    let documents = state.public_document_service.list_user_public_documents(&username, limit, offset).await?;
    
    let response = PublicDocumentListResponse {
        total: documents.len(), // Note: This is the count for this page, not total count
        documents: documents
            .into_iter()
            .map(|doc| PublicDocumentSummary {
                id: doc.id.to_string(),
                title: doc.title,
                document_type: doc.document_type,
                published_at: doc.published_at.to_rfc3339(),
                updated_at: doc.updated_at.to_rfc3339(),
            })
            .collect(),
    };
    
    Ok(Json(response))
}