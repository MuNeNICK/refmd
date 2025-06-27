use std::sync::Arc;
use uuid::Uuid;
use sqlx::PgPool;
use crate::entities::file::Attachment;
use crate::error::Result;

pub struct FileRepository {
    pool: Arc<PgPool>,
}

impl FileRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn create(&self, attachment: &Attachment) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO attachments (
                id, document_id, filename, original_name, mime_type,
                size_bytes, storage_path, uploaded_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
            attachment.id,
            attachment.document_id,
            attachment.filename,
            attachment.original_name,
            attachment.mime_type,
            attachment.size_bytes,
            attachment.storage_path,
            attachment.uploaded_by,
            attachment.created_at
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }

    pub async fn get_by_id_and_user(&self, id: Uuid, user_id: Uuid) -> Result<Option<Attachment>> {
        let attachment = sqlx::query_as!(
            Attachment,
            r#"
            SELECT a.id, a.document_id, a.filename, a.original_name, a.mime_type,
                   a.size_bytes, a.storage_path, a.uploaded_by, a.created_at as "created_at!"
            FROM attachments a
            LEFT JOIN documents d ON a.document_id = d.id
            WHERE a.id = $1 AND (a.uploaded_by = $2 OR d.owner_id = $2)
            "#,
            id,
            user_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(attachment)
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query!(
            "DELETE FROM attachments WHERE id = $1",
            id
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }

    pub async fn list_by_document(&self, document_id: Uuid, limit: i32) -> Result<Vec<Attachment>> {
        let attachments = sqlx::query_as!(
            Attachment,
            r#"
            SELECT id, document_id, filename, original_name, mime_type,
                   size_bytes, storage_path, uploaded_by, created_at as "created_at!"
            FROM attachments
            WHERE document_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
            document_id,
            limit as i64
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(attachments)
    }

    pub async fn get_total_size_by_user(&self, user_id: Uuid) -> Result<i64> {
        let result = sqlx::query!(
            r#"
            SELECT COALESCE(SUM(size_bytes), 0)::BIGINT as "total!"
            FROM attachments
            WHERE uploaded_by = $1
            "#,
            user_id
        )
        .fetch_one(self.pool.as_ref())
        .await?;

        Ok(result.total)
    }

    pub async fn get_by_document_and_filename(&self, document_id: Uuid, filename: &str) -> Result<Option<Attachment>> {
        let attachment = sqlx::query_as!(
            Attachment,
            r#"
            SELECT id, document_id, filename, original_name, mime_type,
                   size_bytes, storage_path, uploaded_by, created_at as "created_at!"
            FROM attachments
            WHERE document_id = $1 AND filename = $2
            "#,
            document_id,
            filename
        )
        .fetch_optional(self.pool.as_ref())
        .await?;

        Ok(attachment)
    }

    pub async fn update_storage_path(&self, id: Uuid, new_path: String) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE attachments
            SET storage_path = $2
            WHERE id = $1
            "#,
            id,
            new_path
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }
}