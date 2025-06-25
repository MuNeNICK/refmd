use std::sync::Arc;
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;
use crate::{
    error::{Error, Result},
    repository::DocumentRepository,
    db::models::Document,
    services::crdt::CrdtService,
    services::git_batch_sync::GitBatchSyncService,
    services::document_links::DocumentLinksService,
    config::Config,
};

pub struct DocumentService {
    document_repo: Arc<DocumentRepository>,
    upload_dir: PathBuf,
    crdt_service: Arc<CrdtService>,
    git_batch_sync_service: Option<Arc<GitBatchSyncService>>,
    config: Arc<Config>,
    document_links_service: Option<Arc<DocumentLinksService>>,
}

impl DocumentService {
    pub fn new(
        document_repo: Arc<DocumentRepository>, 
        upload_dir: PathBuf, 
        crdt_service: Arc<CrdtService>,
        git_batch_sync_service: Option<Arc<GitBatchSyncService>>,
        config: Arc<Config>,
    ) -> Self {
        Self { 
            document_repo,
            upload_dir,
            crdt_service,
            git_batch_sync_service,
            config,
            document_links_service: None,
        }
    }
    
    pub fn with_links_service(mut self, links_service: Arc<DocumentLinksService>) -> Self {
        self.document_links_service = Some(links_service);
        self
    }
    
    pub async fn create_document(&self, owner_id: Uuid, title: &str, content: Option<&str>, doc_type: &str, parent_id: Option<Uuid>) -> Result<Document> {
        if title.trim().is_empty() {
            return Err(Error::BadRequest("Title cannot be empty".to_string()));
        }
        
        // Validate document type
        if doc_type != "document" && doc_type != "folder" && doc_type != "scrap" {
            return Err(Error::BadRequest("Invalid document type".to_string()));
        }
        
        let document = self.document_repo.create(owner_id, title, content, doc_type, parent_id).await?;
        
        // Save to file if it's a document (not a folder)
        if doc_type == "document" || doc_type == "scrap" {
            self.save_to_file(&document).await?;
        }
        
        Ok(document)
    }
    
    pub async fn get_document(&self, id: Uuid, user_id: Uuid) -> Result<Document> {
        // Check if user has permission to view the document
        if !self.document_repo.has_permission(id, user_id, "read").await? {
            return Err(Error::Forbidden);
        }
        
        self.document_repo.get_by_id(id).await?
            .ok_or_else(|| Error::NotFound("Document not found".to_string()))
    }
    
    pub async fn list_documents(&self, user_id: Uuid) -> Result<Vec<Document>> {
        self.document_repo.list_by_owner(user_id).await
    }
    
    pub async fn update_document(&self, id: Uuid, user_id: Uuid, title: Option<&str>, content: Option<&str>, parent_id: Option<Uuid>) -> Result<Document> {
        // Validate title if provided
        if let Some(t) = title {
            if t.trim().is_empty() {
                return Err(Error::BadRequest("Title cannot be empty".to_string()));
            }
        }
        
        // Check if user has permission to update the document
        if !self.document_repo.has_permission(id, user_id, "write").await? {
            return Err(Error::Forbidden);
        }
        
        // Get the old document to track changes
        let old_document = self.document_repo.get_by_id(id).await?
            .ok_or_else(|| Error::NotFound("Document not found".to_string()))?;
        let old_file_path = old_document.file_path.clone();
        
        // Check if we're only updating parent_id (move operation)
        let updated_document = if title.is_none() && content.is_none() {
            // This is a move operation - use the dedicated method that allows NULL
            self.document_repo.update_parent(id, user_id, parent_id).await?
        } else {
            // Normal update
            self.document_repo.update(id, user_id, title, content, parent_id).await?
        };
        
        // Handle file operations if needed
        if updated_document.r#type == "document" {
            // Check if document was moved or renamed
            let needs_move = title.is_some() || parent_id.is_some();
            
            if needs_move {
                self.move_file(&updated_document, old_file_path.as_deref()).await?;
            } else {
                // Just update the content
                self.save_to_file(&updated_document).await?;
            }
        }
        
        Ok(updated_document)
    }
    
    pub async fn delete_document(&self, id: Uuid, user_id: Uuid) -> Result<()> {
        // Check if user has permission to delete the document
        if !self.document_repo.has_permission(id, user_id, "admin").await? {
            return Err(Error::Forbidden);
        }
        
        // Get the document to delete its file
        if let Some(document) = self.document_repo.get_by_id(id).await? {
            // Delete the file from filesystem
            self.delete_file(&document).await?;
        }
        
        // For now, only allow owner to delete
        self.document_repo.delete(id, user_id).await
    }
    
    // Generate a file path for a document based on its hierarchy
    async fn generate_file_path(&self, document: &Document) -> Result<PathBuf> {
        let mut path_components = vec![];
        let mut current_parent_id = document.parent_id;
        
        // Build path from parent hierarchy
        while let Some(parent_id) = current_parent_id {
            if let Some(parent) = self.document_repo.get_by_id(parent_id).await? {
                if parent.r#type == "folder" {
                    path_components.push(self.sanitize_filename(&parent.title));
                }
                current_parent_id = parent.parent_id;
            } else {
                break;
            }
        }
        
        // Reverse to get correct order (root to leaf)
        path_components.reverse();
        
        // Add the document's own filename if it's not a folder
        if document.r#type != "folder" {
            let filename = format!("{}.md", self.sanitize_filename(&document.title));
            path_components.push(filename);
        }
        
        // Build the full path: upload_dir/user_id/...path_components
        let mut full_path = self.upload_dir.clone();
        full_path.push(document.owner_id.to_string());
        for component in path_components {
            full_path.push(component);
        }
        
        Ok(full_path)
    }
    
    // Sanitize filename to be filesystem-safe
    fn sanitize_filename(&self, name: &str) -> String {
        let mut sanitized = name.trim().to_string();
        
        // Replace problematic characters
        let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
        for &ch in &invalid_chars {
            sanitized = sanitized.replace(ch, "-");
        }
        
        // Replace multiple spaces/dashes with single dash
        while sanitized.contains("--") {
            sanitized = sanitized.replace("--", "-");
        }
        
        // Limit length
        if sanitized.len() > 100 {
            sanitized.truncate(100);
        }
        
        // Default name if empty
        if sanitized.is_empty() {
            sanitized = "untitled".to_string();
        }
        
        sanitized
    }
    
    // Save document content to file
    pub async fn save_to_file_with_content(&self, document: &Document, content: &str) -> Result<()> {
        // Only save documents and scraps, not folders
        if document.r#type == "folder" {
            return Ok(());
        }
        
        tracing::info!("Saving document {} with provided content: {} chars", document.id, content.len());
        
        // Generate file path
        let file_path = self.generate_file_path(document).await?;
        
        // Create parent directories if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        // Format content with frontmatter
        let formatted_content = if document.r#type == "scrap" {
            format!(
                r#"---
id: {}
title: {}
type: scrap
created_at: {}
updated_at: {}
---

{}"#,
                document.id,
                document.title,
                document.created_at.format("%Y-%m-%d %H:%M:%S UTC"),
                document.updated_at.format("%Y-%m-%d %H:%M:%S UTC"),
                content
            )
        } else {
            format!(
                r#"---
id: {}
title: {}
created_at: {}
updated_at: {}
---

{}"#,
                document.id,
                document.title,
                document.created_at.format("%Y-%m-%d %H:%M:%S UTC"),
                document.updated_at.format("%Y-%m-%d %H:%M:%S UTC"),
                content
            )
        };
        
        // Write to file with retry
        tracing::info!("Writing to file: {:?}", file_path);
        let mut retries = 3;
        let mut last_error = None;
        
        while retries > 0 {
            match fs::write(&file_path, &formatted_content).await {
                Ok(_) => {
                    tracing::info!("File written successfully");
                    break;
                }
                Err(e) => {
                    retries -= 1;
                    last_error = Some(e);
                    if retries > 0 {
                        tracing::warn!("Failed to write file, retrying... ({} retries left)", retries);
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        }
        
        if let Some(e) = last_error {
            if retries == 0 {
                tracing::error!("Failed to write file after all retries: {}", e);
                return Err(e.into());
            }
        }
        
        // Update the file_path in database
        let relative_path = file_path.strip_prefix(&self.upload_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_path.to_string_lossy().to_string());
        
        self.document_repo.update_file_path(document.id, Some(&relative_path)).await?;
        
        // Queue for batch git sync if enabled
        if self.config.git_auto_sync {
            if let Some(ref batch_sync) = self.git_batch_sync_service {
                batch_sync.queue_sync(document.owner_id, document.title.clone()).await;
            }
        }
        
        // Update document links
        if let Some(ref links_service) = self.document_links_service {
            if let Err(e) = links_service.update_document_links(document.id, &content).await {
                tracing::warn!("Failed to update document links for {}: {}", document.id, e);
                // Don't fail the whole operation if link parsing fails
            }
        }
        
        Ok(())
    }
    
    // Save document content to file (using CRDT)
    pub async fn save_to_file(&self, document: &Document) -> Result<()> {
        // Only save documents and scraps, not folders
        if document.r#type == "folder" {
            return Ok(());
        }
        
        // Get the content from CRDT
        tracing::info!("Getting content from CRDT for document {}", document.id);
        let content = self.crdt_service.get_document_content(document.id).await?;
        tracing::info!("Got content from CRDT: {} chars", content.len());
        
        // Generate file path
        let file_path = self.generate_file_path(document).await?;
        
        // Create parent directories if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        // Format content with frontmatter
        let formatted_content = if document.r#type == "scrap" {
            format!(
                r#"---
id: {}
title: {}
type: scrap
created_at: {}
updated_at: {}
---

{}"#,
                document.id,
                document.title,
                document.created_at.format("%Y-%m-%d %H:%M:%S UTC"),
                document.updated_at.format("%Y-%m-%d %H:%M:%S UTC"),
                content
            )
        } else {
            format!(
                r#"---
id: {}
title: {}
created_at: {}
updated_at: {}
---

{}"#,
                document.id,
                document.title,
                document.created_at.format("%Y-%m-%d %H:%M:%S UTC"),
                document.updated_at.format("%Y-%m-%d %H:%M:%S UTC"),
                content
            )
        };
        
        // Write to file with retry
        tracing::info!("Writing to file: {:?}", file_path);
        let mut retries = 3;
        let mut last_error = None;
        
        while retries > 0 {
            match fs::write(&file_path, &formatted_content).await {
                Ok(_) => {
                    tracing::info!("File written successfully");
                    break;
                }
                Err(e) => {
                    retries -= 1;
                    last_error = Some(e);
                    if retries > 0 {
                        tracing::warn!("Failed to write file, retrying... ({} retries left)", retries);
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        }
        
        if let Some(e) = last_error {
            if retries == 0 {
                tracing::error!("Failed to write file after all retries: {}", e);
                return Err(e.into());
            }
        }
        
        // Update the file_path in database
        let relative_path = file_path.strip_prefix(&self.upload_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_path.to_string_lossy().to_string());
        
        self.document_repo.update_file_path(document.id, Some(&relative_path)).await?;
        
        // Queue for batch git sync if enabled
        if self.config.git_auto_sync {
            if let Some(ref batch_sync) = self.git_batch_sync_service {
                batch_sync.queue_sync(document.owner_id, document.title.clone()).await;
            }
        }
        
        // Update document links
        if let Some(ref links_service) = self.document_links_service {
            if let Err(e) = links_service.update_document_links(document.id, &content).await {
                tracing::warn!("Failed to update document links for {}: {}", document.id, e);
                // Don't fail the whole operation if link parsing fails
            }
        }
        
        Ok(())
    }
    
    // Delete file when document is deleted
    async fn delete_file(&self, document: &Document) -> Result<()> {
        if let Some(file_path) = &document.file_path {
            let full_path = self.upload_dir.join(file_path);
            if full_path.exists() {
                fs::remove_file(full_path).await?;
                
                // Queue deletion for batch git sync if enabled
                if self.config.git_auto_sync {
                    if let Some(ref batch_sync) = self.git_batch_sync_service {
                        batch_sync.queue_sync(document.owner_id, format!("Delete: {}", document.title)).await;
                    }
                }
            }
        }
        Ok(())
    }
    
    // Move file when document is moved or renamed
    async fn move_file(&self, document: &Document, old_path: Option<&str>) -> Result<()> {
        if document.r#type == "folder" {
            // For folders, we need to move all child documents
            // This would require recursive updates - for now, we'll regenerate paths on next save
            return Ok(());
        }
        
        if let Some(old_file_path) = old_path {
            let old_full_path = self.upload_dir.join(old_file_path);
            let new_file_path = self.generate_file_path(document).await?;
            
            if old_full_path.exists() && old_full_path != new_file_path {
                // Create parent directories for new location
                if let Some(parent) = new_file_path.parent() {
                    fs::create_dir_all(parent).await?;
                }
                
                // Move the file
                fs::rename(&old_full_path, &new_file_path).await?;
                
                // Update the file_path in database
                let relative_path = new_file_path.strip_prefix(&self.upload_dir)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| new_file_path.to_string_lossy().to_string());
                
                self.document_repo.update_file_path(document.id, Some(&relative_path)).await?;
                
                // Queue move for batch git sync if enabled
                if self.config.git_auto_sync {
                    if let Some(ref batch_sync) = self.git_batch_sync_service {
                        batch_sync.queue_sync(document.owner_id, format!("Move/rename: {}", document.title)).await;
                    }
                }
            }
        } else {
            // No old path, just save to new location
            self.save_to_file(document).await?;
        }
        
        Ok(())
    }
}