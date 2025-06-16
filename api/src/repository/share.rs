
use std::sync::Arc;
use uuid::Uuid;
use sqlx::PgPool;
use crate::entities::share::{ShareLink, DocumentPermission, Permission};
use crate::error::Result;

pub struct ShareRepository {
    pool: Arc<PgPool>,
}

impl ShareRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn create_share_link(&self, share_link: &ShareLink) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO share_links (
                id, document_id, token, permission, created_by, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
            share_link.id,
            share_link.document_id,
            share_link.token,
            share_link.permission as Permission,
            share_link.created_by,
            share_link.expires_at,
            share_link.created_at
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }

    pub async fn get_share_link_by_token(&self, token: &str) -> Result<Option<ShareLink>> {
        let share_link = sqlx::query_as!(
            ShareLink,
            r#"
            SELECT 
                id, document_id, token, 
                permission as "permission: Permission",
                created_by, expires_at, created_at as "created_at!"
            FROM share_links
            WHERE token = $1
            "#,
            token
        )
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(share_link)
    }

    pub async fn delete_share_link(&self, token: &str) -> Result<()> {
        sqlx::query!(
            "DELETE FROM share_links WHERE token = $1",
            token
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }

    pub async fn get_document_share_links(&self, document_id: Uuid) -> Result<Vec<ShareLink>> {
        let share_links = sqlx::query_as!(
            ShareLink,
            r#"
            SELECT 
                id, document_id, token,
                permission as "permission: Permission",
                created_by, expires_at, created_at as "created_at!"
            FROM share_links
            WHERE document_id = $1
            ORDER BY created_at DESC
            "#,
            document_id
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(share_links)
    }

    pub async fn get_user_permission(&self, document_id: Uuid, user_id: Uuid) -> Result<Option<Permission>> {
        let result = sqlx::query!(
            r#"
            SELECT permission as "permission: Permission"
            FROM document_permissions
            WHERE document_id = $1 AND user_id = $2
            "#,
            document_id,
            user_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(result.map(|r| r.permission))
    }

    pub async fn create_document_permission(&self, permission: &DocumentPermission) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO document_permissions (
                id, document_id, user_id, permission, granted_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (document_id, user_id) 
            DO UPDATE SET permission = $4, granted_by = $5
            "#,
            permission.id,
            permission.document_id,
            permission.user_id,
            permission.permission as Permission,
            permission.granted_by,
            permission.created_at
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }
}