use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    entities::git_config::{GitConfig, GitSyncLog, CreateGitConfigRequest, UpdateGitConfigRequest},
    error::{Error, Result},
};

pub struct GitConfigRepository {
    pool: Arc<PgPool>,
}

impl GitConfigRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn create(&self, user_id: Uuid, request: CreateGitConfigRequest) -> Result<GitConfig> {
        let config = sqlx::query_as!(
            GitConfig,
            r#"
            INSERT INTO git_configs (user_id, repository_url, branch_name, auth_type, auth_data, auto_sync)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at
            "#,
            user_id,
            request.repository_url,
            request.branch_name.unwrap_or_else(|| "main".to_string()),
            request.auth_type,
            request.auth_data,
            request.auto_sync.unwrap_or(true)
        )
        .fetch_one(self.pool.as_ref())
        .await?;

        Ok(config)
    }

    pub async fn get_by_user_id(&self, user_id: Uuid) -> Result<Option<GitConfig>> {
        let config = sqlx::query_as!(
            GitConfig,
            "SELECT id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at FROM git_configs WHERE user_id = $1",
            user_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(config)
    }

    pub async fn update(&self, user_id: Uuid, request: UpdateGitConfigRequest) -> Result<GitConfig> {
        // Build dynamic update query
        let mut query_parts = vec![];
        let mut param_count = 1;
        let mut params: Vec<String> = vec![];

        if let Some(url) = &request.repository_url {
            query_parts.push(format!("repository_url = ${}", param_count));
            params.push(url.clone());
            param_count += 1;
        }

        if let Some(branch) = &request.branch_name {
            query_parts.push(format!("branch_name = ${}", param_count));
            params.push(branch.clone());
            param_count += 1;
        }

        if let Some(auth_type) = &request.auth_type {
            query_parts.push(format!("auth_type = ${}", param_count));
            params.push(auth_type.clone());
            param_count += 1;
        }

        if request.auth_data.is_some() {
            query_parts.push(format!("auth_data = ${}", param_count));
            param_count += 1;
        }

        if request.auto_sync.is_some() {
            query_parts.push(format!("auto_sync = ${}", param_count));
            param_count += 1;
        }

        if query_parts.is_empty() {
            return Err(Error::BadRequest("No fields to update".to_string()));
        }

        let _query = format!(
            "UPDATE git_configs SET {} WHERE user_id = ${} RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at",
            query_parts.join(", "),
            param_count
        );

        // For simplicity, let's use individual updates for each field
        // This is not the most efficient but is easier to implement correctly
        let mut config = self.get_by_user_id(user_id).await?
            .ok_or_else(|| Error::NotFound("Git config not found".to_string()))?;

        if let Some(url) = request.repository_url {
            config = sqlx::query_as!(
                GitConfig,
                "UPDATE git_configs SET repository_url = $1 WHERE user_id = $2 RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at",
                url, user_id
            )
            .fetch_one(self.pool.as_ref())
            .await?;
        }

        if let Some(branch) = request.branch_name {
            config = sqlx::query_as!(
                GitConfig,
                "UPDATE git_configs SET branch_name = $1 WHERE user_id = $2 RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at",
                branch, user_id
            )
            .fetch_one(self.pool.as_ref())
            .await?;
        }

        if let Some(auth_type) = request.auth_type {
            config = sqlx::query_as!(
                GitConfig,
                "UPDATE git_configs SET auth_type = $1 WHERE user_id = $2 RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at",
                auth_type, user_id
            )
            .fetch_one(self.pool.as_ref())
            .await?;
        }

        if let Some(auth_data) = request.auth_data {
            config = sqlx::query_as!(
                GitConfig,
                "UPDATE git_configs SET auth_data = $1 WHERE user_id = $2 RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at",
                auth_data, user_id
            )
            .fetch_one(self.pool.as_ref())
            .await?;
        }

        if let Some(auto_sync) = request.auto_sync {
            config = sqlx::query_as!(
                GitConfig,
                "UPDATE git_configs SET auto_sync = $1 WHERE user_id = $2 RETURNING id, user_id, repository_url, branch_name, auth_type, auth_data, auto_sync, created_at, updated_at",
                auto_sync, user_id
            )
            .fetch_one(self.pool.as_ref())
            .await?;
        }

        Ok(config)
    }

    pub async fn delete(&self, user_id: Uuid) -> Result<()> {
        sqlx::query!("DELETE FROM git_configs WHERE user_id = $1", user_id)
            .execute(self.pool.as_ref())
            .await?;

        Ok(())
    }

    pub async fn log_sync_operation(
        &self,
        user_id: Uuid,
        operation: &str,
        status: &str,
        message: Option<&str>,
        commit_hash: Option<&str>,
    ) -> Result<GitSyncLog> {
        let log = sqlx::query_as!(
            GitSyncLog,
            r#"
            INSERT INTO git_sync_logs (user_id, operation, status, message, commit_hash)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, operation, status, message, commit_hash, created_at
            "#,
            user_id,
            operation,
            status,
            message,
            commit_hash
        )
        .fetch_one(self.pool.as_ref())
        .await?;

        Ok(log)
    }

    pub async fn get_sync_logs(&self, user_id: Uuid, limit: i32) -> Result<Vec<GitSyncLog>> {
        let logs = sqlx::query_as!(
            GitSyncLog,
            "SELECT id, user_id, operation, status, message, commit_hash, created_at FROM git_sync_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
            user_id, limit as i64
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(logs)
    }
}