use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Router,
    routing::{get, post, delete},
    Json,
    middleware::from_fn_with_state,
};
use std::sync::Arc;
use uuid::Uuid;
use serde_json::json;
use crate::{
    state::AppState,
    error::Error,
    middleware::auth::{AuthUser, auth_middleware},
    entities::share::ShareDocumentRequest,
};

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Public routes (no auth required for viewing shared documents)
        .route("/:token", get(get_shared_document))
        // Routes requiring authentication
        .nest("/", Router::new()
            .route("/documents/:id/share", post(create_share_link))
            .route("/documents/:id/shares", get(list_document_shares))
            .route("/:token", delete(delete_share))
            .layer(from_fn_with_state(state.clone(), auth_middleware))
        )
        .with_state(state)
}

async fn create_share_link(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(document_id): Path<Uuid>,
    Json(request): Json<ShareDocumentRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Error> {
    let response = state.share_service.create_share(
        document_id,
        auth_user.user_id,
        request,
    ).await?;

    Ok((StatusCode::CREATED, Json(json!({
        "data": response
    }))))
}

async fn get_shared_document(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<serde_json::Value>, Error> {
    let document = state.share_service.get_shared_document(&token).await?;

    Ok(Json(json!({
        "data": document
    })))
}

async fn delete_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(token): Path<String>,
) -> Result<StatusCode, Error> {
    state.share_service.delete_share(&token, auth_user.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn list_document_shares(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(document_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, Error> {
    let shares = state.share_service.list_document_shares(document_id, auth_user.user_id).await?;
    
    let response: Vec<_> = shares.into_iter()
        .map(|(share, url)| json!({
            "id": share.id,
            "token": share.token,
            "document_id": share.document_id,
            "permission_level": share.permission,
            "created_by": share.created_by,
            "expires_at": share.expires_at,
            "created_at": share.created_at,
            "url": url,
        }))
        .collect();

    Ok(Json(json!({
        "data": response
    })))
}