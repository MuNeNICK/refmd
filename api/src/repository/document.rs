
use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use crate::db::models::Document;
use crate::error::{Error, Result};

#[derive(Clone)]
pub struct DocumentRepository {
    pool: Arc<PgPool>,
}

impl DocumentRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
    
    pub async fn create(&self, owner_id: Uuid, title: &str, _content: Option<&str>, doc_type: &str, parent_id: Option<Uuid>) -> Result<Document> {
        let document = sqlx::query_as!(
            Document,
            r#"
            INSERT INTO documents (owner_id, title, type, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            "#,
            owner_id,
            title,
            doc_type,
            parent_id
        )
        .fetch_one(self.pool.as_ref())
        .await?;
        
        Ok(document)
    }
    
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Document>> {
        let document = sqlx::query_as!(
            Document,
            r#"
            SELECT id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            FROM documents
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(self.pool.as_ref())
        .await?;
        
        Ok(document)
    }
    
    pub async fn get_by_id_and_owner(&self, id: Uuid, owner_id: Uuid) -> Result<Document> {
        let document = sqlx::query_as!(
            Document,
            r#"
            SELECT id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            FROM documents
            WHERE id = $1 AND owner_id = $2
            "#,
            id,
            owner_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("Document not found".to_string()),
            _ => e.into(),
        })?;
        
        Ok(document)
    }
    
    pub async fn get_by_id_and_user(&self, id: Uuid, user_id: Uuid) -> Result<Option<Document>> {
        let document = sqlx::query_as!(
            Document,
            r#"
            SELECT id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            FROM documents
            WHERE id = $1 AND owner_id = $2
            "#,
            id,
            user_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?;
        
        Ok(document)
    }
    
    pub async fn list_by_owner(&self, owner_id: Uuid) -> Result<Vec<Document>> {
        let documents = sqlx::query_as!(
            Document,
            r#"
            SELECT id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            FROM documents
            WHERE owner_id = $1
            ORDER BY updated_at DESC
            "#,
            owner_id
        )
        .fetch_all(self.pool.as_ref())
        .await?;
        
        Ok(documents)
    }
    
    pub async fn update(&self, id: Uuid, owner_id: Uuid, title: Option<&str>, _content: Option<&str>, parent_id: Option<Uuid>) -> Result<Document> {
        let document = sqlx::query_as!(
            Document,
            r#"
            UPDATE documents
            SET 
                title = COALESCE($3, title),
                parent_id = COALESCE($4, parent_id),
                updated_at = NOW(),
                last_edited_by = $2,
                last_edited_at = NOW()
            WHERE id = $1 AND owner_id = $2
            RETURNING id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            "#,
            id,
            owner_id,
            title,
            parent_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("Document not found".to_string()),
            _ => e.into(),
        })?;
        
        Ok(document)
    }
    
    pub async fn delete(&self, id: Uuid, owner_id: Uuid) -> Result<()> {
        let result = sqlx::query!(
            r#"
            DELETE FROM documents
            WHERE id = $1 AND owner_id = $2
            "#,
            id,
            owner_id
        )
        .execute(self.pool.as_ref())
        .await?;
        
        if result.rows_affected() == 0 {
            return Err(Error::NotFound("Document not found".to_string()));
        }
        
        Ok(())
    }
    
    pub async fn update_parent(&self, id: Uuid, owner_id: Uuid, parent_id: Option<Uuid>) -> Result<Document> {
        let document = sqlx::query_as!(
            Document,
            r#"
            UPDATE documents
            SET 
                parent_id = $3,
                updated_at = NOW(),
                last_edited_by = $2,
                last_edited_at = NOW()
            WHERE id = $1 AND owner_id = $2
            RETURNING id, owner_id, title, type as "type: _", parent_id, file_path, crdt_state, version,
                COALESCE(visibility, 'private') as "visibility!", published_at,
                created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            "#,
            id,
            owner_id,
            parent_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("Document not found".to_string()),
            _ => e.into(),
        })?;
        
        Ok(document)
    }
    
    pub async fn has_permission(&self, document_id: Uuid, user_id: Uuid, permission: &str) -> Result<bool> {
        let result = sqlx::query!(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM documents WHERE id = $1 AND owner_id = $2
                UNION
                SELECT 1 FROM document_permissions 
                WHERE document_id = $1 AND user_id = $2 AND permission >= $3
            ) as "exists!"
            "#,
            document_id,
            user_id,
            permission
        )
        .fetch_one(self.pool.as_ref())
        .await?;
        
        Ok(result.exists)
    }
    
    pub async fn update_file_path(&self, id: Uuid, file_path: Option<&str>) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE documents
            SET file_path = $2, updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            file_path
        )
        .execute(self.pool.as_ref())
        .await?;
        
        Ok(())
    }
}