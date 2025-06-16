
use axum::{
    extract::Query,
};
use std::sync::Arc;
use std::collections::HashMap;
use uuid::Uuid;
use crate::{
    state::AppState,
    error::{Error, Result},
    utils::jwt::Claims,
    entities::share::Permission,
};

#[derive(Debug)]
pub struct PermissionCheck {
    pub has_access: bool,
    pub is_share_link: bool,
}

pub async fn check_document_permission(
    state: &Arc<AppState>,
    document_id: Uuid,
    user_id: Option<Uuid>,
    share_token: Option<String>,
    required_permission: Permission,
) -> Result<PermissionCheck> {
    // First check if document exists
    let doc = state.document_repository
        .get_by_id(document_id)
        .await?
        .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
    
    // Check if user is owner
    if let Some(uid) = user_id {
        if doc.owner_id == uid {
            return Ok(PermissionCheck {
                has_access: true,
                is_share_link: false,
            });
        }
        
        // Check explicit permissions
        if let Some(perm) = state.share_repository.get_user_permission(document_id, uid).await? {
            let has_access = perm.has_permission(required_permission);
            return Ok(PermissionCheck {
                has_access,
                is_share_link: false,
            });
        }
    }
    
    // Check share token
    if let Some(token) = share_token {
        if let Some(perm) = state.share_service.get_permission_for_share(document_id, &token).await? {
            let has_access = perm.has_permission(required_permission);
            return Ok(PermissionCheck {
                has_access,
                is_share_link: true,
            });
        }
    }
    
    Ok(PermissionCheck {
        has_access: false,
        is_share_link: false,
    })
}

// Helper extractor for share token from query params
pub async fn extract_share_token(
    Query(params): Query<HashMap<String, String>>,
) -> Option<String> {
    params.get("token").cloned()
}

// Helper function to check permission in handlers
pub async fn ensure_document_permission(
    state: &Arc<AppState>,
    document_id: Uuid,
    claims: Option<Claims>,
    share_token: Option<String>,
    required_permission: Permission,
) -> Result<()> {
    let user_id = claims.map(|c| c.user_id());
    let check = check_document_permission(state, document_id, user_id, share_token, required_permission).await?;
    
    if !check.has_access {
        return Err(Error::Forbidden);
    }
    
    Ok(())
}