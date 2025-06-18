use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Extension, Json, Router,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    entities::scrap::{
        CreateScrapPostRequest, CreateScrapRequest, ScrapPost, ScrapWithPosts, UpdateScrapPostRequest,
        UpdateScrapRequest,
    },
    error::Error,
    middleware::auth::{auth_middleware, AuthUser},
    services::scrap_management::ScrapService,
    state::AppState,
};

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Scrap CRUD endpoints
        .route("/", post(create_scrap).get(get_scraps))
        .route("/:id", get(get_scrap).put(update_scrap).delete(delete_scrap))
        // Scrap posts endpoints
        .route("/:id/posts", get(get_scrap_posts).post(create_scrap_post))
        .route("/:id/posts/:post_id", put(update_scrap_post).delete(delete_scrap_post))
        // All routes require authentication
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        // Public share endpoints (no auth required)
        .route("/shared/:id/:token", get(get_shared_scrap))
        .route("/shared/:id/:token/posts", post(create_shared_scrap_post))
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

pub async fn get_scrap(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let scrap_with_posts = scrap_service.get_scrap(id, auth_user.user_id).await?;
    Ok(Json(scrap_with_posts))
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

pub async fn get_scrap_posts(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, Error> {
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );

    let posts = scrap_service.get_posts(id, auth_user.user_id).await?;
    Ok(Json(posts))
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

// Public scrap access with share token
pub async fn get_shared_scrap(
    State(_state): State<Arc<AppState>>,
    Path((_id, _token)): Path<(Uuid, String)>,
) -> Result<impl IntoResponse, Error> {
    // TODO: Implement share token validation
    // For now, return unauthorized
    Err::<Json<ScrapWithPosts>, Error>(Error::Unauthorized)
}

pub async fn create_shared_scrap_post(
    State(_state): State<Arc<AppState>>,
    Path((_id, _token)): Path<(Uuid, String)>,
    Json(_request): Json<CreateScrapPostRequest>,
) -> Result<impl IntoResponse, Error> {
    // TODO: Implement share token validation and guest post creation
    // For now, return unauthorized
    Err::<Json<ScrapPost>, Error>(Error::Unauthorized)
}