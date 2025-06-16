
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

const MAX_FILE_SIZE: i64 = 10 * 1024 * 1024; // 10MB
const MAX_USER_STORAGE: i64 = 100 * 1024 * 1024; // 100MB

pub struct FileService {
    file_repository: FileRepository,
    document_repository: DocumentRepository,
    share_service: ShareService,
    storage_path: PathBuf,
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
            self.storage_path.join("documents").join(user_id.to_string())
        };

        // Add attachments subdirectory
        let dir_path = base_dir_path.join("attachments");

        // Create directory if it doesn't exist
        fs::create_dir_all(&dir_path).await?;

        // Handle filename conflicts
        let unique_filename = self.get_unique_filename(&dir_path, &filename).await?;
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

    async fn get_unique_filename(&self, dir_path: &Path, filename: &str) -> Result<String> {
        let file_path = dir_path.join(filename);
        if !file_path.exists() {
            return Ok(filename.to_string());
        }

        // Extract base name and extension
        let path = Path::new(filename);
        let stem = path.file_stem().unwrap_or_default().to_string_lossy();
        let ext = path.extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        // Use timestamp and random suffix for uniqueness
        use chrono::Utc;
        use rand::Rng;
        
        loop {
            let timestamp = Utc::now().timestamp_millis();
            let random_suffix: String = rand::thread_rng()
                .sample_iter(&rand::distributions::Alphanumeric)
                .take(6)
                .map(char::from)
                .collect();
            
            let unique_name = format!("{}_{}_{}{}",  stem, timestamp, random_suffix, ext);
            
            // Check uniqueness (extremely unlikely to collide)
            let unique_path = dir_path.join(&unique_name);
            if !unique_path.exists() {
                return Ok(unique_name);
            }
            
            // Wait a millisecond to ensure different timestamp on next iteration (extremely rare)
            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
        }
    }

    // Get the directory path for a document based on its hierarchy
    async fn get_document_directory_path(&self, document: &crate::db::models::Document) -> Result<PathBuf> {
        let mut path_components = vec![];
        let mut current_parent_id = document.parent_id;
        
        // Build path from parent hierarchy
        while let Some(parent_id) = current_parent_id {
            if let Some(parent) = self.document_repository.get_by_id(parent_id).await? {
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
        
        // If the document itself is a folder, add it to the path
        if document.r#type == "folder" {
            path_components.push(self.sanitize_filename(&document.title));
        }
        
        // Build the full path: storage_path/documents/user_id/...path_components
        let mut full_path = self.storage_path.clone();
        full_path.push("documents");
        full_path.push(document.owner_id.to_string());
        for component in path_components {
            full_path.push(component);
        }
        
        Ok(full_path)
    }

    // Sanitize filename to be filesystem-safe
    fn sanitize_filename(&self, name: &str) -> String {
        let mut sanitized = name.trim().to_string();
        
        // Replace spaces with underscores
        sanitized = sanitized.replace(' ', "_");
        
        // Replace problematic characters
        let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
        for &ch in &invalid_chars {
            sanitized = sanitized.replace(ch, "_");
        }
        
        // Replace multiple underscores with single underscore
        while sanitized.contains("__") {
            sanitized = sanitized.replace("__", "_");
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // Helper to create a test FileService instance
    fn create_test_service() -> FileService {
        FileService {
            file_repository: Arc::new(FileRepository::new(sqlx::Pool::disconnected())),
            document_repository: Arc::new(DocumentRepository::new(sqlx::Pool::disconnected())),
            storage_path: PathBuf::from("/tmp"),
        }
    }

    #[test]
    fn test_sanitize_filename_spaces_to_underscores() {
        let service = create_test_service();

        // Test spaces are replaced with underscores
        assert_eq!(service.sanitize_filename("my file name.txt"), "my_file_name.txt");
        assert_eq!(service.sanitize_filename("multiple   spaces.pdf"), "multiple___spaces.pdf");
        assert_eq!(service.sanitize_filename(" leading and trailing spaces "), "leading_and_trailing_spaces");
    }

    #[test]
    fn test_sanitize_filename_invalid_chars() {
        let service = create_test_service();

        // Test invalid characters are replaced with underscores
        assert_eq!(service.sanitize_filename("file:name.txt"), "file_name.txt");
        assert_eq!(service.sanitize_filename("file*name?.txt"), "file_name_.txt");
        assert_eq!(service.sanitize_filename("file<>name|.txt"), "file_name_.txt");
        assert_eq!(service.sanitize_filename("path/to/file.txt"), "path_to_file.txt");
        assert_eq!(service.sanitize_filename("path\\to\\file.txt"), "path_to_file.txt");
    }

    #[test]
    fn test_sanitize_filename_multiple_underscores() {
        let service = create_test_service();

        // Test that multiple underscores are reduced to single underscore
        assert_eq!(service.sanitize_filename("file   name.txt"), "file___name.txt");
        // After replacing spaces, multiple underscores should be reduced
        assert_eq!(service.sanitize_filename("file___name.txt").contains("__"), false);
    }

    #[test]
    fn test_sanitize_filename_edge_cases() {
        let service = create_test_service();

        // Test edge cases
        assert_eq!(service.sanitize_filename(""), "untitled");
        assert_eq!(service.sanitize_filename("   "), "untitled");
        
        // Test long filename truncation
        let long_name = "a".repeat(150);
        let result = service.sanitize_filename(&long_name);
        assert_eq!(result.len(), 100);
    }
}