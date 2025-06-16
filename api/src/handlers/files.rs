use axum::{
    extract::{Extension, Path, Query, State},
    response::{IntoResponse, Response},
    http::{header, StatusCode},
    Router,
    routing::{get, post},
    Json,
    middleware::from_fn_with_state,
};
use axum_extra::extract::Multipart;
use std::sync::Arc;
use uuid::Uuid;
use serde::Deserialize;
use bytes::Bytes;
use crate::{
    state::AppState,
    error::Error,
    middleware::{
        auth::{AuthUser, auth_middleware},
        optional_auth::optional_auth_middleware,
    },
};

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Protected routes - require authentication
        .route("/upload", post(upload_file))
        .route("/:id", get(download_file).delete(delete_file))
        .route("/", get(list_files))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        // Public routes with optional auth - for embedded files in documents
        .route("/documents/:filename", get(download_file_by_name))
        .layer(from_fn_with_state(state.clone(), optional_auth_middleware))
        .with_state(state)
}

#[derive(Deserialize)]
struct ListFilesQuery {
    document_id: Uuid,
    #[serde(default = "default_limit")]
    limit: i32,
}

#[derive(Deserialize)]
struct DownloadByNameQuery {
    document_id: Uuid,
    #[serde(default)]
    token: Option<String>,
}

fn default_limit() -> i32 {
    50
}

async fn upload_file(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, Error> {
    let mut file_data: Option<(String, String, Bytes)> = None;
    let mut document_id: Option<Uuid> = None;

    // Process multipart form data
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "file" => {
                let filename = field.file_name()
                    .ok_or_else(|| Error::BadRequest("No filename provided".to_string()))?
                    .to_string();
                let content_type = field.content_type()
                    .unwrap_or("application/octet-stream")
                    .to_string();
                let data = field.bytes().await?;
                
                // Detect content type if generic
                let final_content_type = if content_type == "application/octet-stream" {
                    detect_content_type(&filename, &data)
                } else {
                    content_type
                };
                
                file_data = Some((filename, final_content_type, data));
            }
            "document_id" => {
                let value = field.text().await?;
                if !value.is_empty() {
                    document_id = Some(value.parse()
                        .map_err(|_| Error::BadRequest("Invalid document ID".to_string()))?);
                }
            }
            _ => {}
        }
    }

    let (filename, content_type, data) = file_data
        .ok_or_else(|| Error::BadRequest("No file provided".to_string()))?;

    let file_response = state.file_service
        .upload(auth_user.user_id, document_id, filename, content_type, data)
        .await?;

    Ok(Json(serde_json::json!({
        "data": file_response
    })))
}

async fn download_file(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(file_id): Path<Uuid>,
) -> Result<Response, Error> {
    let (attachment, data) = state.file_service
        .download(file_id, auth_user.user_id)
        .await?;

    Ok((
        [
            (header::CONTENT_TYPE, attachment.mime_type),
            (header::CONTENT_LENGTH, attachment.size_bytes.to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", attachment.original_name),
            ),
        ],
        data,
    ).into_response())
}

async fn download_file_by_name(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<Option<AuthUser>>,
    Path(filename): Path<String>,
    Query(params): Query<DownloadByNameQuery>,
) -> Result<Response, Error> {
    // Check if user has access to the document (either through auth or share token)
    let user_id = auth_user.as_ref().map(|u| u.user_id);
    
    // Try to get file with appropriate access check
    let (attachment, data) = state.file_service
        .download_by_name_with_access_check(&filename, params.document_id, user_id, params.token)
        .await?;

    Ok((
        [
            (header::CONTENT_TYPE, attachment.mime_type),
            (header::CONTENT_LENGTH, attachment.size_bytes.to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", attachment.original_name),
            ),
        ],
        data,
    ).into_response())
}

async fn delete_file(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(file_id): Path<Uuid>,
) -> Result<StatusCode, Error> {
    state.file_service.delete(file_id, auth_user.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn list_files(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Query(params): Query<ListFilesQuery>,
) -> Result<Json<serde_json::Value>, Error> {
    let files = state.file_service
        .list_by_document(params.document_id, auth_user.user_id, params.limit)
        .await?;

    Ok(Json(serde_json::json!({
        "data": files
    })))
}

fn detect_content_type(filename: &str, data: &[u8]) -> String {
    // Try to detect from first 512 bytes
    let sample = &data[..data.len().min(512)];
    let detected = tree_magic_mini::from_u8(sample);
    
    // If detection gives generic result, try by extension
    if detected == "application/octet-stream" || detected == "text/plain" {
        match filename.split('.').last().map(|s| s.to_lowercase()).as_deref() {
            Some("md") | Some("markdown") => "text/markdown".to_string(),
            Some("json") => "application/json".to_string(),
            Some("csv") => "text/csv".to_string(),
            Some("txt") => "text/plain".to_string(),
            Some("pdf") => "application/pdf".to_string(),
            Some("jpg") | Some("jpeg") => "image/jpeg".to_string(),
            Some("png") => "image/png".to_string(),
            Some("gif") => "image/gif".to_string(),
            Some("webp") => "image/webp".to_string(),
            Some("svg") => "image/svg+xml".to_string(),
            Some("zip") => "application/zip".to_string(),
            _ => detected.to_string(),
        }
    } else {
        detected.to_string()
    }
}