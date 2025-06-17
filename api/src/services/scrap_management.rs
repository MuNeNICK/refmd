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

        // Save to file
        self.document_service
            .save_to_file_with_content(&document, &content)
            .await?;

        Ok(self.document_to_scrap(document))
    }

    pub async fn get_scrap(&self, id: Uuid, user_id: Uuid) -> Result<ScrapWithPosts> {
        // Check access permission
        let has_access = ScrapRepository::check_scrap_access(&*self.pool, id, user_id).await?;
        if !has_access {
            return Err(Error::Forbidden);
        }

        let document = ScrapRepository::get_scrap_by_id(&*self.pool, id).await?;
        let posts = ScrapRepository::get_scrap_posts(&*self.pool, id).await?;

        Ok(ScrapWithPosts {
            scrap: self.document_to_scrap(document),
            posts,
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
            let content = self.crdt_service.get_document_content(document.id).await?;
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

        // Create post in database
        let db_post = ScrapRepository::create_scrap_post(
            &self.pool,
            scrap_id,
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

        // Update file
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, scrap_id).await?;
        if let Some(_) = &document.file_path {
            let content = self.crdt_service.get_document_content(document.id).await?;
            let new_content = ScrapParser::add_post_to_content(&content, &post)?;
            self.document_service
                .save_to_file_with_content(&document, &new_content)
                .await?;
        }

        Ok(post)
    }

    pub async fn get_posts(&self, scrap_id: Uuid, user_id: Uuid) -> Result<Vec<ScrapPost>> {
        // Check access permission
        let has_access = ScrapRepository::check_scrap_access(&*self.pool, scrap_id, user_id).await?;
        if !has_access {
            return Err(Error::Forbidden);
        }

        ScrapRepository::get_scrap_posts(&*self.pool, scrap_id).await
    }

    pub async fn update_post(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
        request: UpdateScrapPostRequest,
    ) -> Result<ScrapPost> {
        // Update in database
        let db_post = ScrapRepository::update_scrap_post(
            &self.pool,
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

        // Update file
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, scrap_id).await?;
        if let Some(_) = &document.file_path {
            let content = self.crdt_service.get_document_content(document.id).await?;
            let new_content = ScrapParser::update_post_in_content(&content, post_id, &request.content)?;
            self.document_service
                .save_to_file_with_content(&document, &new_content)
                .await?;
        }

        Ok(post)
    }

    pub async fn delete_post(
        &self,
        scrap_id: Uuid,
        post_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        // Delete from database
        ScrapRepository::delete_scrap_post(&*self.pool, post_id, user_id).await?;

        // Update file
        let document = ScrapRepository::get_scrap_by_id(&*self.pool, scrap_id).await?;
        if let Some(_) = &document.file_path {
            let content = self.crdt_service.get_document_content(document.id).await?;
            let new_content = ScrapParser::delete_post_from_content(&content, post_id)?;
            self.document_service
                .save_to_file_with_content(&document, &new_content)
                .await?;
        }

        Ok(())
    }

    async fn get_user_name(&self, user_id: Uuid) -> Result<String> {
        use crate::repository::UserRepository;
        
        let user_repo = UserRepository::new(self.pool.clone());
        let user = user_repo.get_by_id(user_id).await?;
        Ok(user.name)
    }

    fn document_to_scrap(&self, document: crate::db::models::Document) -> Scrap {
        Scrap {
            id: document.id,
            owner_id: document.owner_id,
            title: document.title,
            file_path: document.file_path,
            parent_id: document.parent_id,
            created_at: document.created_at,
            updated_at: document.updated_at,
            last_edited_by: document.last_edited_by,
            last_edited_at: document.last_edited_at,
        }
    }
}