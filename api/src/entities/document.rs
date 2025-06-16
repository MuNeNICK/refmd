
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub title: String,
    pub content: Option<String>,
    pub r#type: DocumentType,
    pub file_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentType {
    Document,
    Folder,
}

#[derive(Debug, Deserialize)]
pub struct CreateDocument {
    pub title: String,
    pub content: Option<String>,
    pub r#type: DocumentType,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDocument {
    pub title: Option<String>,
    pub content: Option<String>,
}