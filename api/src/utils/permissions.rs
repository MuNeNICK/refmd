use crate::{
    error::{Error, Result},
    entities::share::Permission,
    repository::{share::ShareRepository, document::DocumentRepository},
};
use uuid::Uuid;
use std::sync::Arc;
use sqlx::PgPool;

/// Check if a user has the required permission on a document
/// This consolidates the permission checking logic used in both ShareService and PublicDocumentService
pub async fn check_document_permission(
    pool: &PgPool,
    document_id: Uuid,
    user_id: Uuid,
    required_permission: Permission,
) -> Result<()> {
    let share_repo = ShareRepository::new(Arc::new(pool.clone()));
    let doc_repo = DocumentRepository::new(Arc::new(pool.clone()));
    
    // First check if user has explicit permission through shares
    let permission = share_repo.get_user_permission(document_id, user_id).await?;
    if let Some(perm) = permission {
        if perm.has_permission(required_permission) {
            return Ok(());
        }
    }
    
    // Then check if user is the owner
    let document = doc_repo.get_by_id(document_id).await?
        .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
    
    if document.owner_id == user_id {
        return Ok(());
    }
    
    Err(Error::Forbidden)
}

/// Check if a user owns a document
pub async fn check_document_ownership(
    pool: &PgPool,
    document_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let doc_repo = DocumentRepository::new(Arc::new(pool.clone()));
    
    let document = doc_repo.get_by_id(document_id).await?
        .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
    
    if document.owner_id != user_id {
        return Err(Error::Forbidden);
    }
    
    Ok(())
}