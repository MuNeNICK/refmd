use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "text")]
#[sqlx(rename_all = "lowercase")]
pub enum Permission {
    #[serde(rename = "view")]
    View,
    #[serde(rename = "comment")]
    Comment,
    #[serde(rename = "edit")]
    Edit,
    #[serde(rename = "admin")]
    Admin,
    #[serde(rename = "owner")]
    Owner,
}

impl Permission {
    pub fn level(&self) -> i32 {
        match self {
            Permission::View => 1,
            Permission::Comment => 2,
            Permission::Edit => 3,
            Permission::Admin => 4,
            Permission::Owner => 5,
        }
    }

    pub fn has_permission(&self, required: Permission) -> bool {
        self.level() >= required.level()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShareLink {
    pub id: Uuid,
    pub document_id: Uuid,
    pub token: String,
    pub permission: Permission,
    pub created_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DocumentPermission {
    pub id: Uuid,
    pub document_id: Uuid,
    pub user_id: Uuid,
    pub permission: Permission,
    pub granted_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ShareDocumentRequest {
    #[serde(rename = "permission")]
    pub permission_level: Permission,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ShareResponse {
    pub token: String,
    pub url: String,
    pub permission: Permission,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SharedDocument {
    pub id: Uuid,
    pub title: String,
    #[serde(rename = "type")]
    pub doc_type: String,
    pub permission: Permission,
}