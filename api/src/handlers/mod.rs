use axum::Router;
use std::sync::Arc;
use crate::state::AppState;

pub mod auth;
pub mod documents;
pub mod files;
pub mod scraps;
pub mod shares;
pub mod user;
pub mod socketio;
pub mod git_sync;

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .nest("/auth", auth::routes(state.clone()))
        .nest("/users", user::routes(state.clone()))
        .nest("/documents", documents::routes(state.clone()))
        .nest("/files", files::routes(state.clone()))
        .nest("/scraps", scraps::routes(state.clone()))
        .nest("/shares", shares::routes(state.clone()))
        .nest("/git", git_sync::routes(state.clone()))
        .nest("/socketio", socketio::routes(state))
}