use std::path::PathBuf;
use uuid::Uuid;
use crate::db::models::Document;
use crate::error::Result;
use crate::repository::document::DocumentRepository;

/// Common trait for services that need path utilities
pub trait PathUtils {
    fn get_storage_path(&self) -> &PathBuf;
    fn get_document_repository(&self) -> &DocumentRepository;
    
    /// Sanitize a filename to be filesystem-safe
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
        
        // Replace spaces with underscores for better compatibility
        sanitized = sanitized.replace(' ', "_");
        
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
    
    /// Get the directory path for a document based on its hierarchy
    async fn get_document_directory_path(&self, document: &Document) -> Result<PathBuf> {
        let mut path_components = vec![];
        let mut current_parent_id = document.parent_id;
        let doc_repo = self.get_document_repository();
        
        // Build path from parent hierarchy
        while let Some(parent_id) = current_parent_id {
            if let Some(parent) = doc_repo.get_by_id(parent_id).await? {
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
        
        // Build the full path: storage_path/user_id/...path_components
        let mut full_path = self.get_storage_path().clone();
        full_path.push(document.owner_id.to_string());
        for component in path_components {
            full_path.push(component);
        }
        
        Ok(full_path)
    }
    
    /// Get the relative path for a document (without storage_path prefix)
    async fn get_relative_document_path(&self, document: &Document) -> Result<PathBuf> {
        let full_path = self.get_document_directory_path(document).await?;
        
        // Remove storage_path prefix to get relative path
        full_path.strip_prefix(self.get_storage_path())
            .map(|p| p.to_path_buf())
            .map_err(|_| crate::error::Error::InternalServerError(
                "Failed to calculate relative path".to_string()
            ))
    }
    
    /// Get a unique filename by appending timestamp if necessary
    async fn get_unique_filename(&self, dir_path: &PathBuf, filename: &str) -> Result<String> {
        
        // First, try the original filename
        let mut unique_path = dir_path.join(filename);
        if !unique_path.exists() {
            return Ok(filename.to_string());
        }
        
        // Extract name and extension
        let path = std::path::Path::new(filename);
        let stem = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();
        
        // Try with timestamp
        for _ in 0..100 {
            let timestamp = chrono::Utc::now().timestamp_millis();
            let unique_name = format!("{}_{}_{}{}", stem, timestamp, Uuid::new_v4().simple(), extension);
            unique_path = dir_path.join(&unique_name);
            
            if !unique_path.exists() {
                return Ok(unique_name);
            }
            
            // Wait a millisecond to ensure different timestamp
            tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
        }
        
        Err(crate::error::Error::InternalServerError(
            "Could not generate unique filename".to_string()
        ))
    }
}