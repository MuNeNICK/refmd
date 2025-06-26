use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;
use sqlx::PgPool;
use crate::entities::scrap::{
    CreateScrapPostRequest, CreateScrapRequest, Scrap, ScrapPost, ScrapWithPosts,
    UpdateScrapPostRequest, UpdateScrapRequest,
};
use crate::error::{Error, Result};
use crate::repository::scrap::ScrapRepository;
use crate::services::document::DocumentService;
use crate::services::crdt::CrdtService;
use crate::services::scrap::ScrapParser;

pub struct ScrapService {
    pool: Arc<PgPool>,
    document_service: Arc<DocumentService>,
    crdt_service: Arc<CrdtService>,
}

impl ScrapService {
    pub fn new(pool: Arc<PgPool>, document_service: Arc<DocumentService>, crdt_service: Arc<CrdtService>) -> Self {
        Self {
            pool,
            document_service,
            crdt_service,
        }
    }

    pub async fn create_scrap(
        &self,
        user_id: Uuid,
        request: CreateScrapRequest,
    ) -> Result<Scrap> {
        // Create the scrap document
        let document = ScrapRepository::create_scrap(&*self.pool, user_id, request).await?;

        // Generate initial content
        let mut metadata = HashMap::new();
        metadata.insert("id".to_string(), document.id.to_string());
        metadata.insert("title".to_string(), document.title.clone());
        metadata.insert("type".to_string(), "scrap".to_string());
        metadata.insert("created_at".to_string(), document.created_at.to_rfc3339());
        metadata.insert("updated_at".to_string(), document.updated_at.to_rfc3339());

        let content = ScrapParser::generate_scrap_content(&document.title, &[], &metadata);

        // Initialize CRDT with initial content
        self.crdt_service.update_document_content(document.id, &content).await?;

        // Save to file
        self.document_service
            .save_to_file_with_content(&document, &content)
            .await?;

        Ok(self.document_to_scrap(document))
    }

    pub async fn get_scrap(&self, id: Uuid, user_id: Uuid) -> Result<ScrapWithPosts> {
        tracing::debug!("Getting scrap: id={}, user_id={}", id, user_id);
        
        // Check access permission
        let has_access = ScrapRepository::check_scrap_access(&*self.pool, id, user_id).await?;
        if !has_access {
            tracing::warn!("Access denied for scrap: id={}, user_id={}", id, user_id);
            return Err(Error::Forbidden);
        }

        tracing::debug!("Fetching scrap document from database");
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, id).await?;
        
        tracing::debug!("Fetching scrap posts from database");
        let posts = ScrapRepository::get_scrap_posts(&*self.pool, id).await?;
        
        tracing::debug!("Successfully fetched scrap with {} posts", posts.len());

        let mut scrap = self.document_to_scrap(document.clone());
        
        // Get owner name for published scraps
        if scrap.visibility == "public" {
            if let Ok(owner) = sqlx::query!("SELECT name FROM users WHERE id = $1", document.owner_id)
                .fetch_one(&*self.pool)
                .await 
            {
                scrap.owner_username = Some(owner.name);
            }
        }

        Ok(ScrapWithPosts {
            scrap,
            posts,
            permission: None,
        })
    }

    pub async fn get_user_scraps(&self, user_id: Uuid) -> Result<Vec<Scrap>> {
        let documents = ScrapRepository::get_user_scraps(&*self.pool, user_id).await?;
        Ok(documents.into_iter().map(|d| self.document_to_scrap(d)).collect())
    }

    pub async fn update_scrap(
        &self,
        id: Uuid,
        user_id: Uuid,
        request: UpdateScrapRequest,
    ) -> Result<Scrap> {
        let document = ScrapRepository::update_scrap(&*self.pool, id, user_id, request).await?;

        // Update file if title changed
        if let Some(_file_path) = &document.file_path {
            // Get content from CRDT
            let content = self.crdt_service.get_document_content(document.id).await?;
            
            // Save to file
            self.document_service
                .save_to_file_with_content(&document, &content)
                .await?;
        }

        Ok(self.document_to_scrap(document))
    }

    pub async fn delete_scrap(&self, id: Uuid, user_id: Uuid) -> Result<()> {
        // Get document to delete file
        let _document = ScrapRepository::get_scrap_by_id(&*self.pool, id).await?;
        
        // Delete from database
        ScrapRepository::delete_scrap(&*self.pool, id, user_id).await?;

        // File deletion will be handled by document service's cleanup process
        // When the document is deleted from the database

        Ok(())
    }

    pub async fn add_post(
        &self,
        scrap_id: Uuid,
        user_id: Uuid,
        request: CreateScrapPostRequest,
    ) -> Result<ScrapPost> {
        // Check access permission
        let has_access = ScrapRepository::check_scrap_access(&*self.pool, scrap_id, user_id).await?;
        if !has_access {
            return Err(Error::Forbidden);
        }
        
        self.add_post_internal(scrap_id, user_id, request).await
    }
    
    // Internal method that skips permission check (for use with share tokens)
    pub async fn add_post_with_permission_bypass(
        &self,
        scrap_id: Uuid,
        user_id: Uuid,
        request: CreateScrapPostRequest,
    ) -> Result<ScrapPost> {
        self.add_post_internal(scrap_id, user_id, request).await
    }
    
    async fn add_post_internal(
        &self,
        scrap_id: Uuid,
        user_id: Uuid,
        request: CreateScrapPostRequest,
    ) -> Result<ScrapPost> {
        tracing::info!("add_post_internal: scrap_id={}, user_id={}", scrap_id, user_id);

        // Use transaction to ensure atomicity
        let mut tx = self.pool.begin().await
            .map_err(|e| {
                tracing::error!("Failed to start transaction: {}", e);
                Error::InternalServerError(format!("Failed to start transaction: {}", e))
            })?;

        // Create post in database within transaction
        let db_post = ScrapRepository::create_scrap_post_tx(
            &mut tx,
            scrap_id,
            user_id,
            request.content.clone(),
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to create post in DB: {:?}", e);
            e
        })?;

        // Get author name
        let author_name = self.get_user_name(user_id).await
            .map_err(|e| {
                tracing::error!("Failed to get user name for user_id={}: {:?}", user_id, e);
                e
            })?;

        let post = ScrapPost {
            id: db_post.id,
            author_id: db_post.author_id,
            author_name: Some(author_name),
            content: db_post.content,
            created_at: db_post.created_at,
            updated_at: db_post.updated_at,
        };

        // Get document within transaction
        let document = ScrapRepository::get_scrap_by_id_tx(&mut tx, scrap_id).await
            .map_err(|e| {
                tracing::error!("Failed to get scrap document: scrap_id={}, error={:?}", scrap_id, e);
                e
            })?;
        
        // Commit transaction first to ensure post is saved
        tx.commit().await
            .map_err(|e| {
                tracing::error!("Failed to commit transaction: {}", e);
                Error::InternalServerError(format!("Failed to commit transaction: {}", e))
            })?;
        
        tracing::info!("Post created successfully in DB: post_id={}, scrap_id={}", post.id, scrap_id);

        // Update CRDT and file with retry mechanism
        if let Some(_file_path) = &document.file_path {
            let max_retries = 3;
            let mut retry_count = 0;
            
            while retry_count < max_retries {
                match self.update_scrap_content_with_post(document.id, &post).await {
                    Ok(_) => break,
                    Err(e) => {
                        retry_count += 1;
                        if retry_count >= max_retries {
                            tracing::error!("Failed to update scrap content after {} retries: {}", max_retries, e);
                            // Don't fail the entire operation - post is already saved in DB
                            break;
                        }
                        // Wait before retry
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                    }
                }
            }
        }

        Ok(post)
    }

    async fn update_scrap_content_with_post(&self, document_id: Uuid, post: &ScrapPost) -> Result<()> {
        // Get current content from CRDT with retry
        let content = self.crdt_service.get_document_content(document_id).await
            .map_err(|e| {
                tracing::error!("Failed to get CRDT content for document {}: {:?}", document_id, e);
                e
            })?;
        
        // Add post to content
        let new_content = ScrapParser::add_post_to_content(&content, post)?;
        
        // Update CRDT - this will handle the synchronization automatically
        let update = self.crdt_service.set_document_content(document_id, &new_content).await?;
        
        // Get document for file save
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, document_id).await?;
        
        // Save to file
        self.document_service
            .save_to_file_with_content(&document, &new_content)
            .await?;
            
        // Notify clients via SocketIO about the new post
        self.notify_scrap_post_added(document_id, post, &update).await?;
            
        Ok(())
    }

    async fn notify_scrap_post_added(&self, document_id: Uuid, post: &ScrapPost, _update: &[u8]) -> Result<()> {
        // Get SocketIO instance from app state if available
        // This will be called from the handlers with the SocketIO instance
        tracing::info!("Scrap post added to document {}: {}", document_id, post.id);
        Ok(())
    }

    pub async fn get_posts(&self, scrap_id: Uuid, user_id: Uuid) -> Result<Vec<ScrapPost>> {
        // Check access permission
        let has_access = ScrapRepository::check_scrap_access(&*self.pool, scrap_id, user_id).await?;
        if !has_access {
            return Err(Error::Forbidden);
        }

        ScrapRepository::get_scrap_posts(&*self.pool, scrap_id).await
    }

    // Public access methods (for shared scraps)
    pub async fn get_scrap_public(&self, id: Uuid) -> Result<ScrapWithPosts> {
        tracing::debug!("Getting public scrap: id={}", id);
        
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, id).await?;
        let posts = ScrapRepository::get_scrap_posts(&*self.pool, id).await?;
        
        let mut scrap = self.document_to_scrap(document.clone());
        
        // Get owner name for published scraps
        if scrap.visibility == "public" {
            if let Ok(owner) = sqlx::query!("SELECT name FROM users WHERE id = $1", document.owner_id)
                .fetch_one(&*self.pool)
                .await 
            {
                scrap.owner_username = Some(owner.name);
            }
        }
        
        Ok(ScrapWithPosts {
            scrap,
            posts,
            permission: None,
        })
    }

    pub async fn get_posts_public(&self, scrap_id: Uuid) -> Result<Vec<ScrapPost>> {
        ScrapRepository::get_scrap_posts(&*self.pool, scrap_id).await
    }

    pub async fn update_post(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
        request: UpdateScrapPostRequest,
    ) -> Result<ScrapPost> {
        // Check if user owns the post or has access to the scrap
        let post = ScrapRepository::get_scrap_post(&*self.pool, post_id).await?;
        if post.author_id != user_id {
            // If not the author, check if they have access to the scrap
            let has_access = ScrapRepository::check_scrap_access(&*self.pool, scrap_id, user_id).await?;
            if !has_access {
                return Err(Error::Forbidden);
            }
        }
        
        self.update_post_internal(scrap_id, post_id, user_id, request).await
    }
    
    // Internal method that skips permission check (for use with share tokens)
    pub async fn update_post_with_permission_bypass(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
        request: UpdateScrapPostRequest,
    ) -> Result<ScrapPost> {
        self.update_post_internal(scrap_id, post_id, user_id, request).await
    }
    
    async fn update_post_internal(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
        request: UpdateScrapPostRequest,
    ) -> Result<ScrapPost> {
        // Use transaction for atomicity
        let mut tx = self.pool.begin().await
            .map_err(|e| Error::InternalServerError(format!("Failed to start transaction: {}", e)))?;

        // Update in database within transaction
        let db_post = ScrapRepository::update_scrap_post_tx(
            &mut tx,
            post_id,
            user_id,
            request.content.clone(),
        )
        .await?;

        // Get author name
        let author_name = self.get_user_name(user_id).await?;

        let post = ScrapPost {
            id: db_post.id,
            author_id: db_post.author_id,
            author_name: Some(author_name),
            content: db_post.content,
            created_at: db_post.created_at,
            updated_at: db_post.updated_at,
        };

        // Get document within transaction
        let document = ScrapRepository::get_scrap_by_id_tx(&mut tx, scrap_id).await
            .map_err(|e| {
                tracing::error!("Failed to get scrap document: scrap_id={}, error={:?}", scrap_id, e);
                e
            })?;
        
        // Commit transaction
        tx.commit().await
            .map_err(|e| Error::InternalServerError(format!("Failed to commit transaction: {}", e)))?;

        // Update CRDT and file with retry mechanism
        if let Some(_) = &document.file_path {
            let max_retries = 3;
            let mut retry_count = 0;
            
            while retry_count < max_retries {
                match self.update_scrap_content_with_post_update(document.id, post_id, &request.content).await {
                    Ok(_) => break,
                    Err(e) => {
                        retry_count += 1;
                        if retry_count >= max_retries {
                            tracing::error!("Failed to update scrap content after {} retries: {}", max_retries, e);
                            break;
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                    }
                }
            }
        }

        Ok(post)
    }

    async fn update_scrap_content_with_post_update(&self, document_id: Uuid, post_id: Uuid, content: &str) -> Result<()> {
        // Get current content from CRDT
        let current_content = self.crdt_service.get_document_content(document_id).await?;
        
        // Update post in content
        let new_content = ScrapParser::update_post_in_content(&current_content, post_id, content)?;
        
        // Update CRDT
        let _update = self.crdt_service.set_document_content(document_id, &new_content).await?;
        
        // Get document for file save
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, document_id).await?;
        
        // Save to file
        self.document_service
            .save_to_file_with_content(&document, &new_content)
            .await?;
            
        // Notify clients
        tracing::info!("Scrap post updated in document {}: {}", document_id, post_id);
        
        Ok(())
    }

    pub async fn delete_post(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        // Check if user owns the post or has access to the scrap
        let post = ScrapRepository::get_scrap_post(&*self.pool, post_id).await?;
        if post.author_id != user_id {
            // If not the author, check if they have access to the scrap
            let has_access = ScrapRepository::check_scrap_access(&*self.pool, scrap_id, user_id).await?;
            if !has_access {
                return Err(Error::Forbidden);
            }
        }
        
        self.delete_post_internal(scrap_id, post_id, user_id).await
    }
    
    // Internal method that skips permission check (for use with share tokens)
    pub async fn delete_post_with_permission_bypass(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        self.delete_post_internal(scrap_id, post_id, user_id).await
    }
    
    async fn delete_post_internal(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        // Use transaction for atomicity
        let mut tx = self.pool.begin().await
            .map_err(|e| Error::InternalServerError(format!("Failed to start transaction: {}", e)))?;

        // Delete from database within transaction
        ScrapRepository::delete_scrap_post_tx(&mut tx, post_id, user_id).await?;

        // Get document within transaction
        let document = ScrapRepository::get_scrap_by_id_tx(&mut tx, scrap_id).await
            .map_err(|e| {
                tracing::error!("Failed to get scrap document: scrap_id={}, error={:?}", scrap_id, e);
                e
            })?;
        
        // Commit transaction
        tx.commit().await
            .map_err(|e| Error::InternalServerError(format!("Failed to commit transaction: {}", e)))?;

        // Update CRDT and file with retry mechanism
        if let Some(_) = &document.file_path {
            let max_retries = 3;
            let mut retry_count = 0;
            
            while retry_count < max_retries {
                match self.update_scrap_content_with_post_delete(document.id, post_id).await {
                    Ok(_) => break,
                    Err(e) => {
                        retry_count += 1;
                        if retry_count >= max_retries {
                            tracing::error!("Failed to update scrap content after {} retries: {}", max_retries, e);
                            break;
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(100 * retry_count as u64)).await;
                    }
                }
            }
        }

        Ok(())
    }

    async fn update_scrap_content_with_post_delete(&self, document_id: Uuid, post_id: Uuid) -> Result<()> {
        // Get current content from CRDT
        let content = self.crdt_service.get_document_content(document_id).await?;
        
        // Delete post from content
        let new_content = ScrapParser::delete_post_from_content(&content, post_id)?;
        
        // Update CRDT
        let _update = self.crdt_service.set_document_content(document_id, &new_content).await?;
        
        // Get document for file save
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, document_id).await?;
        
        // Save to file
        self.document_service
            .save_to_file_with_content(&document, &new_content)
            .await?;
            
        // Notify clients
        tracing::info!("Scrap post deleted from document {}: {}", document_id, post_id);
        
        Ok(())
    }

    async fn get_user_name(&self, user_id: Uuid) -> Result<String> {
        use crate::repository::UserRepository;
        
        // Check if this is a deterministic UUID for anonymous users
        // These UUIDs have a specific pattern created from share token hash
        let user_repo = UserRepository::new(self.pool.clone());
        match user_repo.get_by_id(user_id).await {
            Ok(user) => Ok(user.name),
            Err(_) => {
                // For anonymous users (share link users), return a generic name
                Ok("Anonymous".to_string())
            }
        }
    }

    fn document_to_scrap(&self, document: crate::db::models::Document) -> Scrap {
        document.into()
    }
}