use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Extension, Json, Router,
};
use std::sync::Arc;
use std::collections::HashMap;
use uuid::Uuid;
use serde::Deserialize;

use crate::{
    entities::scrap::{
        CreateScrapPostRequest, CreateScrapRequest, UpdateScrapPostRequest,
        UpdateScrapRequest,
    },
    entities::share::ShareDocumentRequest,
    error::Error,
    middleware::auth::{auth_middleware, AuthUser},
    middleware::optional_auth::{optional_auth_middleware, OptionalAuthUser},
    middleware::permission::check_scrap_permission,
    services::scrap_management::ScrapService,
    state::AppState,
};

#[derive(Deserialize)]
pub struct ShareTokenQuery {
    token: Option<String>,
}

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Scrap CRUD endpoints (authenticated only)
        .route("/", post(create_scrap).get(get_scraps))
        .route("/:id", put(update_scrap).delete(delete_scrap))
        // Share management endpoints (authenticated only)
        .route("/:id/share", post(create_scrap_share))
        .route("/:id/shares", get(list_scrap_shares))
        .route("/shares/:token", delete(delete_scrap_share))
        // All above routes require authentication
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        // Routes with optional auth (can be accessed with or without auth)
        .route("/:id", get(get_scrap_with_optional_auth))
        .route("/:id/posts", get(get_scrap_posts_with_optional_auth).post(create_scrap_post_with_share))
        .route("/:id/posts/:post_id", put(update_scrap_post_with_share).delete(delete_scrap_post_with_share))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            optional_auth_middleware,
        ))
        .with_state(state)
}

pub async fn create_scrap(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(request): Json<CreateScrapRequest>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let scrap = scrap_service.create_scrap(auth_user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(scrap)))
}

pub async fn get_scraps(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let scraps = scrap_service.get_user_scraps(auth_user.user_id).await?;
    Ok(Json(scraps))
}

pub async fn get_scrap_with_optional_auth(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(query): Query<ShareTokenQuery>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    // Check if accessed via share token
    if let Some(token) = query.token {
        // Verify share token for this scrap
        let has_access = state.share_service.verify_share_token(&token, id).await?;
        if !has_access {
            return Err(Error::Forbidden);
        }
        
        // Get scrap without user check (public access via token)
        let scrap_with_posts = scrap_service.get_scrap_public(id).await?;
        Ok(Json(scrap_with_posts))
    } else if let Some(user_id) = auth_user.user_id {
        // Authenticated access
        let scrap_with_posts = scrap_service.get_scrap(id, user_id).await?;
        Ok(Json(scrap_with_posts))
    } else {
        // No token and no auth
        Err(Error::Unauthorized)
    }
}

pub async fn update_scrap(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateScrapRequest>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let scrap = scrap_service.update_scrap(id, auth_user.user_id, request).await?;
    Ok(Json(scrap))
}

pub async fn delete_scrap(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    scrap_service.delete_scrap(id, auth_user.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_scrap_posts_with_optional_auth(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(query): Query<ShareTokenQuery>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    // Check if accessed via share token
    if let Some(token) = query.token {
        // Verify share token for this scrap
        let has_access = state.share_service.verify_share_token(&token, id).await?;
        if !has_access {
            return Err(Error::Forbidden);
        }
        
        // Get posts without user check (public access via token)
        let posts = scrap_service.get_posts_public(id).await?;
        Ok(Json(posts))
    } else if let Some(user_id) = auth_user.user_id {
        // Authenticated access
        let posts = scrap_service.get_posts(id, user_id).await?;
        Ok(Json(posts))
    } else {
        // No token and no auth
        Err(Error::Unauthorized)
    }
}

pub async fn create_scrap_post(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(request): Json<CreateScrapPostRequest>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let post = scrap_service.add_post(id, auth_user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(post)))
}

pub async fn update_scrap_post(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((scrap_id, post_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateScrapPostRequest>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let post = scrap_service
        .update_post(scrap_id, post_id, auth_user.user_id, request)
        .await?;
    Ok(Json(post))
}

pub async fn delete_scrap_post(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((scrap_id, post_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    scrap_service
        .delete_post(scrap_id, post_id, auth_user.user_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// Share management endpoints
pub async fn create_scrap_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(request): Json<ShareDocumentRequest>,
) -> Result<impl IntoResponse, Error> {
    let response = state.share_service.create_share(
        id,
        auth_user.user_id,
        request,
    ).await?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({
        "data": response
    }))))
}

pub async fn list_scrap_shares(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, Error> {
    let shares = state.share_service.list_document_shares(id, auth_user.user_id).await?;
    
    let response: Vec<_> = shares.into_iter()
        .map(|(share, url)| serde_json::json!({
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

    Ok(Json(serde_json::json!({
        "data": response
    })))
}

pub async fn delete_scrap_share(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(token): Path<String>,
) -> Result<impl IntoResponse, Error> {
    state.share_service.delete_share(&token, auth_user.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// Handlers with share token support
pub async fn create_scrap_post_with_share(
    State(state): State<Arc<AppState>>,
    Extension(opt_user): Extension<OptionalAuthUser>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    Json(request): Json<CreateScrapPostRequest>,
) -> Result<impl IntoResponse, Error> {
    let share_token = params.get("token").cloned();
    
    // Check permission with share token support
    let permission_result = check_scrap_permission(
        &state,
        id,
        opt_user.user_id,
        share_token.clone(),
        crate::entities::share::Permission::Edit,
    ).await?;
    
    if !permission_result.has_access {
        return Err(Error::Forbidden);
    }
    
    // For share links without authentication, use a placeholder user_id
    // This is a temporary solution - in production, you might want to track anonymous users differently
    let user_id = opt_user.user_id.unwrap_or_else(|| {
        // Use a deterministic UUID based on the share token for anonymous users
        // This ensures consistency for the same share token
        if let Some(token) = &share_token {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            token.hash(&mut hasher);
            let hash = hasher.finish();
            // Create a deterministic UUID v4 from the hash
            let bytes = hash.to_be_bytes();
            let mut uuid_bytes = [0u8; 16];
            uuid_bytes[..8].copy_from_slice(&bytes);
            uuid_bytes[8..].copy_from_slice(&bytes); // Duplicate for full 16 bytes
            // Set version (4) and variant bits
            uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x40;
            uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80;
            Uuid::from_bytes(uuid_bytes)
        } else {
            // This shouldn't happen as we checked permission with share token
            Uuid::new_v4()
        }
    });
    
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let post = scrap_service.add_post(id, user_id, request).await?;
    
    // The CRDT service will automatically handle synchronization 
    // and the SocketIO sync manager will broadcast updates to connected clients
    
    Ok((StatusCode::CREATED, Json(post)))
}

pub async fn update_scrap_post_with_share(
    State(state): State<Arc<AppState>>,
    Extension(opt_user): Extension<OptionalAuthUser>,
    Path((scrap_id, post_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<HashMap<String, String>>,
    Json(request): Json<UpdateScrapPostRequest>,
) -> Result<impl IntoResponse, Error> {
    let share_token = params.get("token").cloned();
    
    // Check permission with share token support
    let permission_result = check_scrap_permission(
        &state,
        scrap_id,
        opt_user.user_id,
        share_token.clone(),
        crate::entities::share::Permission::Edit,
    ).await?;
    
    if !permission_result.has_access {
        return Err(Error::Forbidden);
    }
    
    // For share links without authentication, use a placeholder user_id
    // This is a temporary solution - in production, you might want to track anonymous users differently
    let user_id = opt_user.user_id.unwrap_or_else(|| {
        // Use a deterministic UUID based on the share token for anonymous users
        // This ensures consistency for the same share token
        if let Some(token) = &share_token {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            token.hash(&mut hasher);
            let hash = hasher.finish();
            // Create a deterministic UUID v4 from the hash
            let bytes = hash.to_be_bytes();
            let mut uuid_bytes = [0u8; 16];
            uuid_bytes[..8].copy_from_slice(&bytes);
            uuid_bytes[8..].copy_from_slice(&bytes); // Duplicate for full 16 bytes
            // Set version (4) and variant bits
            uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x40;
            uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80;
            Uuid::from_bytes(uuid_bytes)
        } else {
            // This shouldn't happen as we checked permission with share token
            Uuid::new_v4()
        }
    });
    
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let post = scrap_service
        .update_post(scrap_id, post_id, user_id, request)
        .await?;
    Ok(Json(post))
}

pub async fn delete_scrap_post_with_share(
    State(state): State<Arc<AppState>>,
    Extension(opt_user): Extension<OptionalAuthUser>,
    Path((scrap_id, post_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, Error> {
    let share_token = params.get("token").cloned();
    
    // Check permission with share token support
    let permission_result = check_scrap_permission(
        &state,
        scrap_id,
        opt_user.user_id,
        share_token.clone(),
        crate::entities::share::Permission::Edit,
    ).await?;
    
    if !permission_result.has_access {
        return Err(Error::Forbidden);
    }
    
    // For share links without authentication, use a placeholder user_id
    // This is a temporary solution - in production, you might want to track anonymous users differently
    let user_id = opt_user.user_id.unwrap_or_else(|| {
        // Use a deterministic UUID based on the share token for anonymous users
        // This ensures consistency for the same share token
        if let Some(token) = &share_token {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            token.hash(&mut hasher);
            let hash = hasher.finish();
            // Create a deterministic UUID v4 from the hash
            let bytes = hash.to_be_bytes();
            let mut uuid_bytes = [0u8; 16];
            uuid_bytes[..8].copy_from_slice(&bytes);
            uuid_bytes[8..].copy_from_slice(&bytes); // Duplicate for full 16 bytes
            // Set version (4) and variant bits
            uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x40;
            uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80;
            Uuid::from_bytes(uuid_bytes)
        } else {
            // This shouldn't happen as we checked permission with share token
            Uuid::new_v4()
        }
    });
    
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    scrap_service
        .delete_post(scrap_id, post_id, user_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

