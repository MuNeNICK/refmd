use std::sync::Arc;
use uuid::Uuid;
use sqlx::PgPool;
use chrono::Utc;
use crate::entities::share::{ShareLink, ShareDocumentRequest, ShareResponse, SharedDocument, Permission};
use crate::error::{Error, Result};
use crate::repository::share::ShareRepository;
use crate::repository::document::DocumentRepository;

pub struct ShareService {
    share_repository: ShareRepository,
    document_repository: DocumentRepository,
    frontend_url: String,
}

impl ShareService {
    pub fn new(pool: Arc<PgPool>, frontend_url: String) -> Self {
        Self {
            share_repository: ShareRepository::new(pool.clone()),
            document_repository: DocumentRepository::new(pool.clone()),
            frontend_url,
        }
    }

    pub async fn create_share(
        &self,
        document_id: Uuid,
        user_id: Uuid,
        request: ShareDocumentRequest,
    ) -> Result<ShareResponse> {
        // Verify user has admin permission on the document
        let permission = self.share_repository.get_user_permission(document_id, user_id).await?;
        if !permission.map(|p| p.has_permission(Permission::Admin)).unwrap_or(false) {
            // Check if user is owner
            let doc = self.document_repository.get_by_id(document_id).await?
                .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
            if doc.owner_id != user_id {
                return Err(Error::Forbidden);
            }
        }

        // Generate unique token
        let token = generate_token();

        // Create share link
        let share_link = ShareLink {
            id: Uuid::new_v4(),
            document_id,
            token: token.clone(),
            permission: request.permission_level,
            created_by: user_id,
            expires_at: request.expires_at,
            created_at: Utc::now(),
        };

        self.share_repository.create_share_link(&share_link).await?;

        // Generate share URL
        let url = format!("{}/document/{}?token={}", self.frontend_url, document_id, token);

        Ok(ShareResponse {
            token,
            url,
            permission: request.permission_level,
            expires_at: request.expires_at,
        })
    }

    pub async fn get_shared_document(&self, token: &str) -> Result<SharedDocument> {
        // Get share link
        let share_link = self.share_repository.get_share_link_by_token(token).await?
            .ok_or_else(|| Error::NotFound("Share link not found".to_string()))?;

        // Check if expired
        if let Some(expires_at) = share_link.expires_at {
            if expires_at < Utc::now() {
                return Err(Error::BadRequest("Share link has expired".to_string()));
            }
        }

        // Get document
        let doc = self.document_repository.get_by_id(share_link.document_id).await?
            .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;

        Ok(SharedDocument {
            id: doc.id,
            title: doc.title,
            doc_type: doc.r#type,
            permission: share_link.permission,
        })
    }

    pub async fn delete_share(&self, token: &str, user_id: Uuid) -> Result<()> {
        // Get share link
        let share_link = self.share_repository.get_share_link_by_token(token).await?
            .ok_or_else(|| Error::NotFound("Share link not found".to_string()))?;

        // Check if user can delete (creator or document admin/owner)
        if share_link.created_by != user_id {
            let permission = self.share_repository.get_user_permission(share_link.document_id, user_id).await?;
            if !permission.map(|p| p.has_permission(Permission::Admin)).unwrap_or(false) {
                // Check if user is owner
                let doc = self.document_repository.get_by_id(share_link.document_id).await?
                    .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
                if doc.owner_id != user_id {
                    return Err(Error::Forbidden);
                }
            }
        }

        self.share_repository.delete_share_link(token).await?;
        Ok(())
    }

    pub async fn verify_share_token(&self, token: &str, document_id: Uuid) -> Result<bool> {
        // Get share link
        let share_link = self.share_repository.get_share_link_by_token(token).await?;
        
        match share_link {
            Some(link) => {
                // Check if the token is for the requested document
                Ok(link.document_id == document_id && link.expires_at.map(|exp| exp > Utc::now()).unwrap_or(true))
            }
            None => Ok(false)
        }
    }

    pub async fn list_document_shares(&self, document_id: Uuid, user_id: Uuid) -> Result<Vec<(ShareLink, String)>> {
        // Verify user has admin permission on the document
        let permission = self.share_repository.get_user_permission(document_id, user_id).await?;
        if !permission.map(|p| p.has_permission(Permission::Admin)).unwrap_or(false) {
            // Check if user is owner
            let doc = self.document_repository.get_by_id(document_id).await?
                .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
            if doc.owner_id != user_id {
                return Err(Error::Forbidden);
            }
        }

        let shares = self.share_repository.get_document_share_links(document_id).await?;
        
        // Add URLs to shares
        let shares_with_urls = shares.into_iter()
            .map(|share| {
                let url = format!("{}/document/{}?token={}", self.frontend_url, document_id, share.token);
                (share, url)
            })
            .collect();

        Ok(shares_with_urls)
    }

    pub async fn get_permission_for_share(&self, document_id: Uuid, token: &str) -> Result<Option<Permission>> {
        let share_link = self.share_repository.get_share_link_by_token(token).await?;
        
        if let Some(link) = share_link {
            if link.document_id != document_id {
                return Ok(None);
            }
            
            // Check if expired
            if let Some(expires_at) = link.expires_at {
                if expires_at < Utc::now() {
                    return Ok(None);
                }
            }
            
            Ok(Some(link.permission))
        } else {
            Ok(None)
        }
    }
}

fn generate_token() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const TOKEN_LEN: usize = 32;
    
    let mut rng = rand::thread_rng();
    (0..TOKEN_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}