use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use crate::{
    error::{Error, Result},
    db::models::PublicDocumentInfo,
};

pub struct PublicDocumentService {
    pool: Arc<PgPool>,
}

impl PublicDocumentService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Make a document public
    pub async fn publish_document(&self, document_id: Uuid, user_id: Uuid) -> Result<()> {
        // Verify ownership
        let document = sqlx::query!(
            "SELECT id, owner_id, title FROM documents WHERE id = $1",
            document_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?
        .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;

        if document.owner_id != user_id {
            return Err(Error::Forbidden);
        }

        // Update document to be public
        sqlx::query!(
            r#"
            UPDATE documents 
            SET visibility = 'public', updated_at = NOW()
            WHERE id = $1
            "#,
            document_id
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }

    /// Make a document private
    pub async fn unpublish_document(&self, document_id: Uuid, user_id: Uuid) -> Result<()> {
        // Verify ownership
        let document = sqlx::query!(
            "SELECT id, owner_id FROM documents WHERE id = $1",
            document_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?
        .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;

        if document.owner_id != user_id {
            return Err(Error::Forbidden);
        }

        // Update document to be private (trigger will handle slug clearing)
        sqlx::query!(
            "UPDATE documents SET visibility = 'private', updated_at = NOW() WHERE id = $1",
            document_id
        )
        .execute(self.pool.as_ref())
        .await?;

        Ok(())
    }


    /// Get public document by username and document ID
    pub async fn get_public_document(&self, username: &str, document_id: &str) -> Result<PublicDocumentInfo> {
        let doc_uuid = uuid::Uuid::parse_str(document_id)
            .map_err(|_| Error::BadRequest("Invalid document ID format".to_string()))?;
            
        let result = sqlx::query!(
            r#"
            SELECT 
                d.id,
                d.title,
                d.type as document_type,
                d.published_at,
                d.updated_at,
                u.username as owner_username,
                u.name as owner_name
            FROM documents d
            JOIN users u ON u.id = d.owner_id
            WHERE d.visibility = 'public' 
            AND d.id = $1 
            AND u.username = $2
            "#,
            doc_uuid,
            username
        )
        .fetch_optional(self.pool.as_ref())
        .await?
        .ok_or_else(|| Error::NotFound("Public document not found".to_string()))?;

        Ok(PublicDocumentInfo {
            id: result.id,
            title: result.title,
            content: None, // Content will be loaded separately via CRDT service
            document_type: result.document_type,
            published_at: result.published_at.unwrap_or(result.updated_at.unwrap_or(chrono::Utc::now())),
            updated_at: result.updated_at.unwrap_or(chrono::Utc::now()),
            owner_username: result.owner_username,
            owner_name: result.owner_name,
        })
    }

    /// List all public documents by a user
    pub async fn list_user_public_documents(&self, username: &str, limit: i64, offset: i64) -> Result<Vec<PublicDocumentInfo>> {
        let results = sqlx::query!(
            r#"
            SELECT 
                d.id,
                d.title,
                d.type as document_type,
                d.published_at,
                d.updated_at,
                u.username as owner_username,
                u.name as owner_name
            FROM documents d
            JOIN users u ON u.id = d.owner_id
            WHERE d.visibility = 'public' 
            AND u.username = $1
            ORDER BY d.published_at DESC
            LIMIT $2 OFFSET $3
            "#,
            username,
            limit,
            offset
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(results
            .into_iter()
            .map(|row| PublicDocumentInfo {
                id: row.id,
                title: row.title,
                content: None,
                document_type: row.document_type,
                published_at: row.published_at.unwrap_or(row.updated_at.unwrap_or(chrono::Utc::now())),
                updated_at: row.updated_at.unwrap_or(chrono::Utc::now()),
                owner_username: row.owner_username,
                owner_name: row.owner_name,
            })
            .collect())
    }

    /// Get user's published documents (for their own management)
    pub async fn list_my_public_documents(&self, user_id: Uuid) -> Result<Vec<PublicDocumentInfo>> {
        let results = sqlx::query!(
            r#"
            SELECT 
                d.id,
                d.title,
                d.type as document_type,
                d.published_at,
                d.updated_at,
                u.username as owner_username,
                u.name as owner_name
            FROM documents d
            JOIN users u ON u.id = d.owner_id
            WHERE d.visibility = 'public' 
            AND d.owner_id = $1
            ORDER BY d.published_at DESC
            "#,
            user_id
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(results
            .into_iter()
            .map(|row| PublicDocumentInfo {
                id: row.id,
                title: row.title,
                content: None,
                document_type: row.document_type,
                published_at: row.published_at.unwrap_or(row.updated_at.unwrap_or(chrono::Utc::now())),
                updated_at: row.updated_at.unwrap_or(chrono::Utc::now()),
                owner_username: row.owner_username,
                owner_name: row.owner_name,
            })
            .collect())
    }




}


