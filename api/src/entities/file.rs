
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub document_id: Option<Uuid>,
    pub filename: String,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_path: String,
    pub uploaded_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub filename: String,
    pub size: i64,
    pub mime_type: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateFile {
    pub document_id: Option<Uuid>,
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
}