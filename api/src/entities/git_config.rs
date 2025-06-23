use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use crate::utils::encryption::EncryptionService;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GitConfig {
    pub id: Uuid,
    pub user_id: Uuid,
    pub repository_url: String,
    pub branch_name: String,
    pub auth_type: String, // 'ssh' or 'token'
    pub auth_data: serde_json::Value, // Encrypted SSH private key or token
    pub auto_sync: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl GitConfig {
    /// Decrypt auth data using the provided encryption service
    pub fn decrypt_auth_data(&self, encryption_service: &EncryptionService) -> Result<serde_json::Value> {
        match &self.auth_data {
            serde_json::Value::Object(obj) => {
                let mut decrypted_data = serde_json::Map::new();
                
                for (key, value) in obj {
                    if let serde_json::Value::String(encrypted_str) = value {
                        let decrypted = encryption_service.decrypt(encrypted_str)?;
                        decrypted_data.insert(key.clone(), serde_json::Value::String(decrypted));
                    } else {
                        decrypted_data.insert(key.clone(), value.clone());
                    }
                }
                
                Ok(serde_json::Value::Object(decrypted_data))
            }
            _ => Ok(self.auth_data.clone())
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateGitConfigRequest {
    pub repository_url: String,
    pub branch_name: Option<String>,
    pub auth_type: String,
    pub auth_data: serde_json::Value,
    pub auto_sync: Option<bool>,
}

impl CreateGitConfigRequest {
    /// Encrypt sensitive auth data before storing
    pub fn encrypt_auth_data(&mut self, encryption_service: &EncryptionService) -> Result<()> {
        match &mut self.auth_data {
            serde_json::Value::Object(obj) => {
                for (key, value) in obj.iter_mut() {
                    if (key == "private_key" || key == "token") && value.is_string() {
                        if let serde_json::Value::String(plaintext) = value {
                            let encrypted = encryption_service.encrypt(plaintext)?;
                            *value = serde_json::Value::String(encrypted);
                        }
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateGitConfigRequest {
    pub repository_url: Option<String>,
    pub branch_name: Option<String>,
    pub auth_type: Option<String>,
    pub auth_data: Option<serde_json::Value>,
    pub auto_sync: Option<bool>,
}

impl UpdateGitConfigRequest {
    /// Encrypt sensitive auth data before storing
    pub fn encrypt_auth_data(&mut self, encryption_service: &EncryptionService) -> Result<()> {
        if let Some(auth_data) = &mut self.auth_data {
            match auth_data {
                serde_json::Value::Object(obj) => {
                    for (key, value) in obj.iter_mut() {
                        if (key == "private_key" || key == "token") && value.is_string() {
                            if let serde_json::Value::String(plaintext) = value {
                                let encrypted = encryption_service.encrypt(plaintext)?;
                                *value = serde_json::Value::String(encrypted);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }
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