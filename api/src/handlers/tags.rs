use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use std::sync::Arc;
use uuid::Uuid;
use serde::Deserialize;

use crate::{
    entities::tag::TagListResponse,
    error::Error,
    middleware::auth::{auth_middleware, AuthUser},
    repository::tag::TagRepository,
    services::scrap_management::ScrapService,
    state::AppState,
};

#[derive(Deserialize)]
pub struct ListTagsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(list_tags))
        .route("/:name/posts", get(get_posts_by_tag))
        .route("/:name/documents", get(get_documents_by_tag))
        .route("/:name/all", get(get_all_by_tag))
        .route("/scraps/:id/tags", get(get_scrap_tags))
        .route("/documents/:id/tags", get(get_document_tags))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state)
}

async fn list_tags(
    Extension(_auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListTagsQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(100);
    let offset = query.offset.unwrap_or(0);
    
    let tag_repository = TagRepository::new((*state.db_pool).clone());
    
    match tag_repository.get_all_tags_with_unified_count(Some(limit), Some(offset)).await {
        Ok((tags, total)) => {
            Json(TagListResponse { tags, total }).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list tags: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn get_posts_by_tag(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(tag_name): Path<String>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    let tag_repository = TagRepository::new((*state.db_pool).clone());
    
    match tag_repository.get_scrap_posts_by_tag(&tag_name, user_id).await {
        Ok(post_ids) => {
            Json(serde_json::json!({
                "tag": tag_name,
                "post_ids": post_ids,
            })).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get posts by tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn get_scrap_tags(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(scrap_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    let scrap_service = ScrapService::new(
        state.db_pool.clone(),
        state.document_service.clone(),
        state.crdt_service.clone(),
    );
    let tag_repository = TagRepository::new((*state.db_pool).clone());
    
    // Check access to scrap
    match scrap_service.get_scrap(scrap_id, user_id).await {
        Ok(scrap_with_posts) => {
            // Get tags for each post
            let mut all_tags = Vec::new();
            for post in scrap_with_posts.posts {
                match tag_repository.get_scrap_post_tags(post.id).await {
                    Ok(tags) => all_tags.extend(tags),
                    Err(e) => {
                        tracing::error!("Failed to get tags for post {}: {:?}", post.id, e);
                    }
                }
            }
            
            // Deduplicate tags
            all_tags.sort_by(|a, b| a.name.cmp(&b.name));
            all_tags.dedup_by(|a, b| a.name == b.name);
            
            Json(all_tags).into_response()
        }
        Err(Error::Forbidden) => StatusCode::FORBIDDEN.into_response(),
        Err(Error::NotFound(_)) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => {
            tracing::error!("Failed to get scrap tags: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn get_documents_by_tag(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(tag_name): Path<String>,
    Query(query): Query<ListTagsQuery>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    let tag_repository = TagRepository::new((*state.db_pool).clone());
    
    match tag_repository.get_documents_by_tag(&tag_name, user_id, query.limit, query.offset).await {
        Ok(document_ids) => {
            Json(serde_json::json!({
                "tag": tag_name,
                "document_ids": document_ids,
            })).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get documents by tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn get_all_by_tag(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(tag_name): Path<String>,
    Query(query): Query<ListTagsQuery>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    let tag_repository = TagRepository::new((*state.db_pool).clone());
    
    // Get both documents and scrap posts
    let documents_result = tag_repository.get_documents_by_tag(&tag_name, user_id, query.limit, query.offset).await;
    let posts_result = tag_repository.get_scrap_posts_by_tag(&tag_name, user_id).await;
    
    match (documents_result, posts_result) {
        (Ok(document_ids), Ok(post_ids)) => {
            Json(serde_json::json!({
                "tag": tag_name,
                "documents": document_ids,
                "scrap_posts": post_ids,
            })).into_response()
        }
        (Err(e), _) | (_, Err(e)) => {
            tracing::error!("Failed to get content by tag: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn get_document_tags(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(document_id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    let tag_repository = TagRepository::new((*state.db_pool).clone());
    
    // Check access to document
    match state.document_service.get_document(document_id, user_id).await {
        Ok(_document) => {
            match tag_repository.get_document_tags(document_id).await {
                Ok(tags) => Json(tags).into_response(),
                Err(e) => {
                    tracing::error!("Failed to get document tags: {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR.into_response()
                }
            }
        }
        Err(Error::Forbidden) => StatusCode::FORBIDDEN.into_response(),
        Err(Error::NotFound(_)) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => {
            tracing::error!("Failed to get document: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}