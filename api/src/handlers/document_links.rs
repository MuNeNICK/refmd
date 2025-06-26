use axum::{
    extract::{State, Path, Query},
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::Result,
    state::AppState,
    middleware::optional_auth::OptionalAuthUser,
};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    10
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub document_type: String,
    pub path: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct BacklinksResponse {
    pub backlinks: Vec<BacklinkInfo>,
    pub total_count: usize,
}

#[derive(Debug, Serialize)]
pub struct BacklinkInfo {
    pub document_id: String,
    pub title: String,
    pub document_type: String,
    pub file_path: Option<String>,
    pub link_type: String,
    pub link_text: Option<String>,
    pub link_count: i64,
}

#[derive(Debug, Serialize)]
pub struct OutgoingLinksResponse {
    pub links: Vec<OutgoingLink>,
    pub total_count: usize,
}

#[derive(Debug, Serialize)]
pub struct OutgoingLink {
    pub document_id: String,
    pub title: String,
    pub document_type: String,
    pub file_path: Option<String>,
    pub link_type: String,
    pub link_text: Option<String>,
    pub position_start: Option<i32>,
    pub position_end: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct LinkStatsResponse {
    pub backlink_count: usize,
    pub outgoing_link_count: usize,
}

/// Get backlinks for a document
#[axum::debug_handler]
pub async fn get_backlinks(
    State(state): State<Arc<AppState>>,
    Path(document_id): Path<Uuid>,
    Extension(auth_user): Extension<OptionalAuthUser>,
) -> Result<Json<BacklinksResponse>> {
    let user_id = auth_user.user_id.ok_or(crate::error::Error::Unauthorized)?;
    // Check if user has permission to view the document
    if !state.document_repository.has_permission(document_id, user_id, "view").await? {
        return Err(crate::error::Error::Forbidden);
    }
    
    // Pass user_id to filter results based on permissions
    let backlinks = state.document_links_service.get_backlinks(document_id, Some(user_id)).await?;
    
    let response = BacklinksResponse {
        total_count: backlinks.len(),
        backlinks: backlinks
            .into_iter()
            .map(|link| BacklinkInfo {
                document_id: link.document_id.to_string(),
                title: link.title,
                document_type: link.document_type,
                file_path: link.file_path,
                link_type: link.link_type,
                link_text: link.link_text,
                link_count: link.link_count,
            })
            .collect(),
    };
    
    Ok(Json(response))
}

/// Get outgoing links from a document
#[axum::debug_handler]
pub async fn get_outgoing_links(
    State(state): State<Arc<AppState>>,
    Path(document_id): Path<Uuid>,
    Extension(auth_user): Extension<OptionalAuthUser>,
) -> Result<Json<OutgoingLinksResponse>> {
    let user_id = auth_user.user_id.ok_or(crate::error::Error::Unauthorized)?;
    // Check if user has permission to view the document
    if !state.document_repository.has_permission(document_id, user_id, "view").await? {
        return Err(crate::error::Error::Forbidden);
    }
    
    let links = state.document_links_service.get_outgoing_links(document_id, Some(user_id)).await?;
    
    let response = OutgoingLinksResponse {
        total_count: links.len(),
        links: links
            .into_iter()
            .map(|link| OutgoingLink {
                document_id: link.document_id.to_string(),
                title: link.title,
                document_type: link.document_type,
                file_path: link.file_path,
                link_type: link.link_type,
                link_text: link.link_text,
                position_start: link.position_start,
                position_end: link.position_end,
            })
            .collect(),
    };
    
    Ok(Json(response))
}

/// Search documents by title for autocomplete
#[axum::debug_handler]
pub async fn search_documents(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchQuery>,
    Extension(auth_user): Extension<OptionalAuthUser>,
) -> Result<Json<Vec<SearchResult>>> {
    let user_id = auth_user.user_id.ok_or(crate::error::Error::Unauthorized)?;
    let resolver = state.document_links_service.link_resolver.clone();
    let suggestions = resolver.get_suggestions(&query.q, user_id).await?;
    
    let results: Vec<SearchResult> = suggestions
        .into_iter()
        .map(|suggestion| SearchResult {
            id: suggestion.id.to_string(),
            title: suggestion.title,
            document_type: suggestion.document_type,
            path: suggestion.path,
            updated_at: suggestion.updated_at.to_rfc3339(),
        })
        .collect();
    
    Ok(Json(results))
}

/// Get link statistics for a document
#[axum::debug_handler]
pub async fn get_link_stats(
    State(state): State<Arc<AppState>>,
    Path(document_id): Path<Uuid>,
    Extension(auth_user): Extension<OptionalAuthUser>,
) -> Result<Json<LinkStatsResponse>> {
    let user_id = auth_user.user_id.ok_or(crate::error::Error::Unauthorized)?;
    // Check if user has permission to view the document
    if !state.document_repository.has_permission(document_id, user_id, "view").await? {
        return Err(crate::error::Error::Forbidden);
    }
    
    let stats = state.document_links_service.get_link_stats(document_id).await?;
    
    let response = LinkStatsResponse {
        backlink_count: stats.backlink_count,
        outgoing_link_count: stats.outgoing_link_count,
    };
    
    Ok(Json(response))
}