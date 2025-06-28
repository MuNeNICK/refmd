
use std::path::{Path, PathBuf};
use std::sync::Arc;
use uuid::Uuid;
use bytes::Bytes;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use chrono::Utc;
use sqlx::PgPool;
use crate::entities::file::{Attachment, FileResponse};
use crate::error::{Error, Result};
use crate::repository::file::FileRepository;
use crate::repository::document::DocumentRepository;
use crate::services::share::ShareService;
use crate::services::common::path_utils::PathUtils;

const MAX_FILE_SIZE: i64 = 10 * 1024 * 1024; // 10MB
const MAX_USER_STORAGE: i64 = 100 * 1024 * 1024; // 100MB

pub struct FileService {
    file_repository: FileRepository,
    document_repository: DocumentRepository,
    share_service: ShareService,
    storage_path: PathBuf,
}

impl PathUtils for FileService {
    fn get_storage_path(&self) -> &PathBuf {
        &self.storage_path
    }
    
    fn get_document_repository(&self) -> &DocumentRepository {
        &self.document_repository
    }
}

impl FileService {
    pub fn new(pool: Arc<PgPool>, storage_path: PathBuf, frontend_url: String) -> Self {
        Self {
            file_repository: FileRepository::new(pool.clone()),
            document_repository: DocumentRepository::new(pool.clone()),
            share_service: ShareService::new(pool.clone(), frontend_url),
            storage_path,
        }
    }

    pub async fn upload(
        &self,
        user_id: Uuid,
        document_id: Option<Uuid>,
        filename: String,
        content_type: String,
        data: Bytes,
    ) -> Result<FileResponse> {
        // Check file size
        let size = data.len() as i64;
        if size > MAX_FILE_SIZE {
            return Err(Error::BadRequest("File too large. Maximum size is 10MB".to_string()));
        }

        // Check user storage limit
        let current_usage = self.file_repository.get_total_size_by_user(user_id).await?;
        if current_usage + size > MAX_USER_STORAGE {
            return Err(Error::BadRequest("Storage limit exceeded".to_string()));
        }

        // Verify document access and get document if document_id is provided
        let document = if let Some(doc_id) = document_id {
            let doc = self.document_repository.get_by_id_and_user(doc_id, user_id).await?
                .ok_or_else(|| Error::NotFound("Document not found or access denied".to_string()))?;
            Some(doc)
        } else {
            None
        };

        // Determine storage directory based on document hierarchy
        let base_dir_path = if let Some(doc) = &document {
            // Get the document's directory path (same logic as generate_file_path)
            self.get_document_directory_path(doc).await?
        } else {
            // No document, save in user's root directory
            self.storage_path.join(user_id.to_string())
        };

        // Add attachments subdirectory
        let dir_path = base_dir_path.join("attachments");

        // Create directory if it doesn't exist
        fs::create_dir_all(&dir_path).await?;

        // Handle filename conflicts using trait method
        let unique_filename = PathUtils::get_unique_filename(self, &dir_path, &filename).await?;
        let file_path = dir_path.join(&unique_filename);

        // Save file to disk
        let mut file = fs::File::create(&file_path).await?;
        file.write_all(&data).await?;
        file.sync_all().await?;

        // Create database record
        let attachment = Attachment {
            id: Uuid::new_v4(),
            document_id,
            filename: unique_filename.clone(),
            original_name: filename,
            mime_type: content_type,
            size_bytes: size,
            storage_path: file_path.to_string_lossy().to_string(),
            uploaded_by: user_id,
            created_at: Utc::now(),
        };

        self.file_repository.create(&attachment).await?;

        // Return response with relative path instead of API URL
        Ok(FileResponse {
            id: attachment.id,
            filename: attachment.filename.clone(),
            size: attachment.size_bytes,
            mime_type: attachment.mime_type.clone(),
            url: format!("./attachments/{}", attachment.filename),
        })
    }

    pub async fn download(&self, file_id: Uuid, user_id: Uuid) -> Result<(Attachment, Bytes)> {
        // Get file record with access check
        let attachment = self.file_repository.get_by_id_and_user(file_id, user_id).await?
            .ok_or_else(|| Error::NotFound("File not found".to_string()))?;

        // Read file from disk
        let data = fs::read(&attachment.storage_path).await
            .map_err(|_| Error::NotFound("File not found on disk".to_string()))?;

        Ok((attachment, Bytes::from(data)))
    }

    pub async fn download_by_name(&self, filename: &str, document_id: Uuid, user_id: Uuid) -> Result<(Attachment, Bytes)> {
        // Verify document access
        self.document_repository.get_by_id_and_user(document_id, user_id).await?
            .ok_or_else(|| Error::NotFound("Document not found or access denied".to_string()))?;

        // Get file record by document_id and filename
        let attachment = self.file_repository.get_by_document_and_filename(document_id, filename).await?
            .ok_or_else(|| Error::NotFound("File not found".to_string()))?;

        // Read file from disk
        let data = fs::read(&attachment.storage_path).await
            .map_err(|_| Error::NotFound("File not found on disk".to_string()))?;

        Ok((attachment, Bytes::from(data)))
    }

    pub async fn download_by_name_with_access_check(
        &self, 
        filename: &str, 
        document_id: Uuid, 
        user_id: Option<Uuid>,
        share_token: Option<String>
    ) -> Result<(Attachment, Bytes)> {
        // Check if user has access via authentication or share token
        let has_access = if let Some(token) = share_token {
            // Check share token
            self.share_service.verify_share_token(&token, document_id).await?
        } else if let Some(uid) = user_id {
            // Check user access
            self.document_repository.get_by_id_and_user(document_id, uid).await?
                .is_some()
        } else {
            // No authentication and no share token - deny access
            false
        };

        if !has_access {
            return Err(Error::Unauthorized);
        }

        // Get file record by document_id and filename
        let attachment = self.file_repository.get_by_document_and_filename(document_id, filename).await?
            .ok_or_else(|| Error::NotFound("File not found".to_string()))?;

        // Read file from disk
        let data = fs::read(&attachment.storage_path).await
            .map_err(|_| Error::NotFound("File not found on disk".to_string()))?;

        Ok((attachment, Bytes::from(data)))
    }

    pub async fn delete(&self, file_id: Uuid, user_id: Uuid) -> Result<()> {
        // Get file record with access check
        let attachment = self.file_repository.get_by_id_and_user(file_id, user_id).await?
            .ok_or_else(|| Error::NotFound("File not found".to_string()))?;

        // Delete file from disk (ignore errors if file doesn't exist)
        let _ = fs::remove_file(&attachment.storage_path).await;

        // Delete database record
        self.file_repository.delete(file_id).await?;

        Ok(())
    }

    pub async fn list_by_document(&self, document_id: Uuid, user_id: Uuid, limit: i32) -> Result<Vec<FileResponse>> {
        // Verify document access
        let doc = self.document_repository.get_by_id_and_user(document_id, user_id).await?;
        if doc.is_none() {
            return Err(Error::NotFound("Document not found or access denied".to_string()));
        }

        // Get files
        let attachments = self.file_repository.list_by_document(document_id, limit).await?;

        // Convert to response format with relative paths
        Ok(attachments.into_iter().map(|a| FileResponse {
            id: a.id,
            filename: a.filename.clone(),
            size: a.size_bytes,
            mime_type: a.mime_type.clone(),
            url: format!("./attachments/{}", a.filename),
        }).collect())
    }

    // Use the trait methods instead of duplicating them

    // Move all attachments for a document from old path to new path
    pub async fn move_attachments(
        &self,
        document_id: Uuid,
        old_base_path: &Path,
        new_base_path: &Path,
    ) -> Result<()> {
        // Get all attachments for this document
        let attachments = self.file_repository.list_by_document(document_id, 1000).await?;
        
        if attachments.is_empty() {
            return Ok(());
        }

        // Create the new attachments directory
        let new_attachments_dir = new_base_path.join("attachments");
        fs::create_dir_all(&new_attachments_dir).await?;

        // Move each attachment file and update database
        for attachment in attachments {
            let old_path = PathBuf::from(&attachment.storage_path);
            
            // Only proceed if the file exists
            if old_path.exists() {
                let new_path = new_attachments_dir.join(&attachment.filename);
                
                // Move the file
                fs::rename(&old_path, &new_path).await
                    .map_err(|e| Error::InternalServerError(format!("Failed to move attachment {}: {}", attachment.filename, e)))?;
                
                // Update the database record with new path
                self.file_repository.update_storage_path(
                    attachment.id,
                    new_path.to_string_lossy().to_string()
                ).await?;
            }
        }

        // Try to remove the old attachments directory if it's empty
        let old_attachments_dir = old_base_path.join("attachments");
        if old_attachments_dir.exists() {
            // Ignore errors when removing directory (it might not be empty if shared with other documents)
            let _ = fs::remove_dir(&old_attachments_dir).await;
        }

        Ok(())
    }

    // Move attachments when a folder is moved (affects all child documents)
    pub async fn move_folder_attachments(
        &self,
        folder_id: Uuid,
        old_folder_path: &Path,
        new_folder_path: &Path,
    ) -> Result<()> {
        // Get all documents in this folder (recursively)
        let documents = self.document_repository.get_all_descendants(folder_id).await?;
        
        for document in documents {
            if document.r#type != "folder" {
                // Calculate old and new paths for this document
                let relative_path = self.get_relative_document_path(&document, folder_id).await?;
                
                let old_doc_path = old_folder_path.join(&relative_path);
                let new_doc_path = new_folder_path.join(&relative_path);
                
                // Move attachments for this document
                self.move_attachments(document.id, &old_doc_path, &new_doc_path).await?;
            }
        }
        
        Ok(())
    }

    // Helper to get the relative path of a document from a specific folder
    async fn get_relative_document_path(
        &self,
        document: &crate::db::models::Document,
        from_folder_id: Uuid,
    ) -> Result<PathBuf> {
        let mut path_components = vec![];
        let mut current_parent_id = document.parent_id;
        
        // Build path from document up to the specified folder
        while let Some(parent_id) = current_parent_id {
            if parent_id == from_folder_id {
                break;
            }
            
            if let Some(parent) = self.document_repository.get_by_id(parent_id).await? {
                if parent.r#type == "folder" {
                    path_components.push(PathUtils::sanitize_filename(self, &parent.title));
                }
                current_parent_id = parent.parent_id;
            } else {
                break;
            }
        }
        
        // Reverse to get correct order
        path_components.reverse();
        
        // Build the relative path
        let mut relative_path = PathBuf::new();
        for component in path_components {
            relative_path = relative_path.join(component);
        }
        
        Ok(relative_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // Helper to create a test FileService instance
    fn create_test_service() -> FileService {
        use sqlx::postgres::PgPoolOptions;
        let pool = std::sync::Arc::new(PgPoolOptions::new().connect_lazy("postgres://test").unwrap());
        FileService {
            file_repository: FileRepository::new(pool.clone()),
            document_repository: DocumentRepository::new(pool.clone()),
            share_service: ShareService::new(pool.clone(), "http://localhost".to_string()),
            storage_path: PathBuf::from("/tmp"),
        }
    }

    #[test]
    fn test_sanitize_filename_spaces() {
        let service = create_test_service();

        // Test spaces are kept as-is (not replaced with dashes in filenames themselves)
        assert_eq!(PathUtils::sanitize_filename(&service, "my file name.txt"), "my_file_name.txt");
        assert_eq!(PathUtils::sanitize_filename(&service, "multiple   spaces.pdf"), "multiple___spaces.pdf");
        assert_eq!(PathUtils::sanitize_filename(&service, " leading and trailing spaces "), "leading_and_trailing_spaces");
    }

    #[test]
    fn test_sanitize_filename_invalid_chars() {
        let service = create_test_service();

        // Test invalid characters are replaced with dashes
        assert_eq!(PathUtils::sanitize_filename(&service, "file:name.txt"), "file-name.txt");
        assert_eq!(PathUtils::sanitize_filename(&service, "file*name?.txt"), "file-name-.txt");
        assert_eq!(PathUtils::sanitize_filename(&service, "file<>name|.txt"), "file--name-.txt");
        assert_eq!(PathUtils::sanitize_filename(&service, "path/to/file.txt"), "path-to-file.txt");
        assert_eq!(PathUtils::sanitize_filename(&service, "path\\to\\file.txt"), "path-to-file.txt");
    }

    #[test]
    fn test_sanitize_filename_multiple_underscores() {
        let service = create_test_service();

        // Test that multiple underscores are reduced to single underscore
        assert_eq!(PathUtils::sanitize_filename(&service, "file   name.txt"), "file___name.txt");
        // After replacing spaces, multiple underscores should be reduced
        assert_eq!(PathUtils::sanitize_filename(&service, "file___name.txt").contains("__"), false);
    }

    #[test]
    fn test_sanitize_filename_edge_cases() {
        let service = create_test_service();

        // Test edge cases
        assert_eq!(PathUtils::sanitize_filename(&service, ""), "untitled");
        assert_eq!(PathUtils::sanitize_filename(&service, "   "), "untitled");
        
        // Test long filename truncation
        let long_name = "a".repeat(150);
        let result = PathUtils::sanitize_filename(&service, &long_name);
        assert_eq!(result.len(), 100);
    }
}