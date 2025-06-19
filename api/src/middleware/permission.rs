
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

// Generic permission check that works for all document types
pub async fn check_resource_permission(
    state: &Arc<AppState>,
    resource_id: Uuid,
    user_id: Option<Uuid>,
    share_token: Option<String>,
    required_permission: Permission,
    expected_type: Option<&str>, // None for any type, Some("scrap") for scraps only, etc.
) -> Result<PermissionCheck> {
    // First check if resource exists
    let doc = state.document_repository
        .get_by_id(resource_id)
        .await?
        .ok_or_else(|| {
            let resource_name = expected_type.unwrap_or("Resource");
            Error::NotFound(format!("{} not found", resource_name))
        })?;
    
    // Check type if specified
    if let Some(expected) = expected_type {
        if doc.r#type != expected {
            return Err(Error::NotFound(format!("Document is not a {}", expected)));
        }
    }
    
    // Check if user is owner
    if let Some(uid) = user_id {
        if doc.owner_id == uid {
            return Ok(PermissionCheck {
                has_access: true,
                is_share_link: false,
            });
        }
        
        // Check explicit permissions (only for regular documents, not scraps)
        if expected_type.is_none() || expected_type == Some("document") {
            if let Some(perm) = state.share_repository.get_user_permission(resource_id, uid).await? {
                let has_access = perm.has_permission(required_permission);
                return Ok(PermissionCheck {
                    has_access,
                    is_share_link: false,
                });
            }
        }
    }
    
    // Check share token
    if let Some(token) = share_token {
        if state.share_service.verify_share_token(&token, resource_id).await? {
            if let Some(perm) = state.share_service.get_permission_for_share(resource_id, &token).await? {
                let has_access = perm.has_permission(required_permission);
                return Ok(PermissionCheck {
                    has_access,
                    is_share_link: true,
                });
            }
        }
    }
    
    Ok(PermissionCheck {
        has_access: false,
        is_share_link: false,
    })
}

// Wrapper for backward compatibility with documents
pub async fn check_document_permission(
    state: &Arc<AppState>,
    document_id: Uuid,
    user_id: Option<Uuid>,
    share_token: Option<String>,
    required_permission: Permission,
) -> Result<PermissionCheck> {
    check_resource_permission(
        state, 
        document_id, 
        user_id, 
        share_token, 
        required_permission, 
        None // Any type allowed for generic documents
    ).await
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

// Wrapper for scrap permission checking
pub async fn check_scrap_permission(
    state: &Arc<AppState>,
    scrap_id: Uuid,
    user_id: Option<Uuid>,
    share_token: Option<String>,
    required_permission: Permission,
) -> Result<PermissionCheck> {
    check_resource_permission(
        state, 
        scrap_id, 
        user_id, 
        share_token, 
        required_permission, 
        Some("scrap") // Restrict to scrap type only
    ).await
}

// Auto-detect resource type and check permissions accordingly
pub async fn check_any_resource_permission(
    state: &Arc<AppState>,
    resource_id: Uuid,
    user_id: Option<Uuid>,
    share_token: Option<String>,
    required_permission: Permission,
) -> Result<PermissionCheck> {
    check_resource_permission(
        state, 
        resource_id, 
        user_id, 
        share_token, 
        required_permission, 
        None // Allow any type - auto-detect
    ).await
}