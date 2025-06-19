use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GitConfig {
    pub id: Uuid,
    pub user_id: Uuid,
    pub repository_url: String,
    pub branch_name: String,
    pub auth_type: String, // 'ssh' or 'token'
    pub auth_data: serde_json::Value, // SSH key path or token
    pub auto_sync: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateGitConfigRequest {
    pub repository_url: String,
    pub branch_name: Option<String>,
    pub auth_type: String,
    pub auth_data: serde_json::Value,
    pub auto_sync: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateGitConfigRequest {
    pub repository_url: Option<String>,
    pub branch_name: Option<String>,
    pub auth_type: Option<String>,
    pub auth_data: Option<serde_json::Value>,
    pub auto_sync: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitConfigResponse {
    pub id: Uuid,
    pub repository_url: String,
    pub branch_name: String,
    pub auth_type: String,
    pub auto_sync: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<GitConfig> for GitConfigResponse {
    fn from(config: GitConfig) -> Self {
        Self {
            id: config.id,
            repository_url: config.repository_url,
            branch_name: config.branch_name,
            auth_type: config.auth_type,
            auto_sync: config.auto_sync,
            created_at: config.created_at,
            updated_at: config.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GitSyncLog {
    pub id: Uuid,
    pub user_id: Uuid,
    pub operation: String, // 'push', 'pull', 'commit'
    pub status: String,    // 'success', 'error'
    pub message: Option<String>,
    pub commit_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitSyncLogResponse {
    pub id: Uuid,
    pub operation: String,
    pub status: String,
    pub message: Option<String>,
    pub commit_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<GitSyncLog> for GitSyncLogResponse {
    fn from(log: GitSyncLog) -> Self {
        Self {
            id: log.id,
            operation: log.operation,
            status: log.status,
            message: log.message,
            commit_hash: log.commit_hash,
            created_at: log.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub repository_initialized: bool,
    pub has_remote: bool,
    pub current_branch: Option<String>,
    pub uncommitted_changes: u32,
    pub untracked_files: u32,
    pub last_sync: Option<DateTime<Utc>>,
    pub sync_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitSyncRequest {
    pub message: Option<String>,
    pub force: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitSyncResponse {
    pub success: bool,
    pub message: String,
    pub commit_hash: Option<String>,
    pub files_changed: u32,
}