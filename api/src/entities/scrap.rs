use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::db::models::Document;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scrap {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub title: String,
    pub file_path: Option<String>,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_edited_by: Option<Uuid>,
    pub last_edited_at: Option<DateTime<Utc>>,
    pub visibility: String,
    pub published_at: Option<DateTime<Utc>>,
    pub owner_username: Option<String>, // Actually owner name
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapPost {
    pub id: Uuid,
    pub author_id: Uuid,
    pub author_name: Option<String>,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapWithPosts {
    pub scrap: Scrap,
    pub posts: Vec<ScrapPost>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateScrapRequest {
    pub title: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateScrapRequest {
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateScrapPostRequest {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateScrapPostRequest {
    pub content: String,
}

impl From<Document> for Scrap {
    fn from(doc: Document) -> Self {
        Self {
            id: doc.id,
            owner_id: doc.owner_id,
            title: doc.title,
            file_path: doc.file_path,
            parent_id: doc.parent_id,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            last_edited_by: doc.last_edited_by,
            last_edited_at: doc.last_edited_at,
            visibility: doc.visibility,
            published_at: doc.published_at,
            owner_username: None, // This will be populated when needed
        }
    }
}