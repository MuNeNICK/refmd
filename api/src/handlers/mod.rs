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
pub mod document_links;
pub mod public_documents;
pub mod tags;

pub fn routes(state: Arc<AppState>) -> Router {
    // Merge document routes with public document management routes
    let document_routes = documents::routes(state.clone())
        .merge(public_documents::protected_routes(state.clone()));
    
    Router::new()
        .nest("/auth", auth::routes(state.clone()))
        .nest("/users", user::routes(state.clone()))
        .nest("/documents", document_routes)
        .nest("/files", files::routes(state.clone()))
        .nest("/scraps", scraps::routes(state.clone()))
        .nest("/shares", shares::routes(state.clone()))
        .nest("/git", git_sync::routes(state.clone()))
        .nest("/socketio", socketio::routes(state.clone()))
        .nest("/tags", tags::routes(state.clone()))
        .merge(public_documents::routes(state.clone()))
        .merge(public_documents::my_documents_routes(state))
}