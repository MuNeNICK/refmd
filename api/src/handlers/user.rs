use axum::{
    extract::{State, Extension},
    Json,
    Router,
    routing::get,
    middleware::from_fn_with_state,
};
use std::sync::Arc;
use crate::{
    error::Result,
    state::AppState,
    repository::UserRepository,
    middleware::auth::{auth_middleware, AuthUser},
};
use super::auth::UserResponse;

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/me", get(get_current_user))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<UserResponse>> {
    let user_repo = UserRepository::new(state.db_pool.clone());
    let user = user_repo.get_by_id(auth_user.user_id).await?;
    
    Ok(Json(user.into()))
}