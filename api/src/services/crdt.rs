
use std::sync::Arc;
use uuid::Uuid;
use sqlx::{Transaction, Postgres};
use chrono::{DateTime, Utc};

use crate::error::Result;
use crate::crdt::{
    DocumentManager, AwarenessManager, DocumentPersistence, 
    CrdtDocument, UserPresence
};

/// Service for managing CRDT operations
pub struct CrdtService {
    document_manager: Arc<DocumentManager>,
    awareness_manager: Arc<AwarenessManager>,
    document_persistence: Arc<DocumentPersistence>,
}

impl CrdtService {
    pub fn new(
        document_manager: Arc<DocumentManager>,
        awareness_manager: Arc<AwarenessManager>,
        document_persistence: Arc<DocumentPersistence>,
    ) -> Self {
        Self {
            document_manager,
            awareness_manager,
            document_persistence,
        }
    }

    /// Load or create a CRDT document
    pub async fn load_or_create_document(&self, document_id: Uuid) -> Result<Arc<parking_lot::RwLock<CrdtDocument>>> {
        // Check if already in cache
        if let Some(doc) = self.document_manager.get(&document_id) {
            tracing::info!("Document {} found in cache", document_id);
            return Ok(doc);
        }

        // Try to load from database
        tracing::info!("Loading document {} from database", document_id);
        if let Some(doc) = self.document_persistence.load_document(document_id).await? {
            // Document exists in DB, load it into cache
            tracing::info!("Document {} loaded from database", document_id);
            let doc_arc = self.document_manager.get_or_create(document_id);
            {
                let mut cached_doc = doc_arc.write();
                *cached_doc = doc;
            }
            Ok(doc_arc)
        } else {
            // Create new document
            tracing::info!("Creating new document {}", document_id);
            Ok(self.document_manager.get_or_create(document_id))
        }
    }

    /// Save document to database
    pub async fn save_document(&self, document_id: Uuid) -> Result<()> {
        if let Some(doc) = self.document_manager.get(&document_id) {
            // Get the state and drop the lock before await
            let state = {
                let doc = doc.read();
                doc.get_state_as_update()?
            };
            
            // Create a temporary document for persistence
            let temp_doc = CrdtDocument::from_state(document_id, &state)?;
            
            // Save to CRDT tables
            self.document_persistence.save_document(&temp_doc).await?;
            
            // Sync back to main documents table
            self.document_persistence.sync_to_documents_table(&temp_doc).await?;
        }
        Ok(())
    }

    /// Apply and save an update
    pub async fn apply_update(
        &self, 
        document_id: Uuid, 
        update: &[u8],
        tx: &mut Transaction<'_, Postgres>,
    ) -> Result<()> {
        // Apply to in-memory document
        let doc = self.document_manager.get_or_create(document_id);
        {
            let mut doc = doc.write();
            doc.apply_update(update)?;
        }

        // Save update to history
        self.document_persistence.save_update(document_id, update, tx).await?;

        Ok(())
    }

    /// Get document content as markdown
    pub async fn get_document_content(&self, document_id: Uuid) -> Result<String> {
        tracing::info!("Getting content for document {}", document_id);
        let doc = self.load_or_create_document(document_id).await?;
        let doc = doc.read();
        let content = doc.get_content()?;
        tracing::info!("Got content: {} chars", content.len());
        Ok(content)
    }

    /// Set document content from markdown
    pub async fn set_document_content(
        &self, 
        document_id: Uuid, 
        content: &str,
    ) -> Result<Vec<u8>> {
        tracing::info!("Setting content for document {}: {} chars", document_id, content.len());
        let doc = self.load_or_create_document(document_id).await?;
        
        // Get the update that will be generated
        let update = {
            let mut doc = doc.write();
            let state_before = doc.get_state_vector();
            
            doc.set_content(content)?;
            tracing::info!("Content set in CRDT");
            
            doc.get_update_since(&state_before)?
        };

        // Save the document state
        tracing::info!("Saving document state to database");
        self.save_document(document_id).await?;
        tracing::info!("Document state saved");

        Ok(update)
    }

    /// Get updates since a timestamp
    pub async fn get_updates_since(
        &self,
        document_id: Uuid,
        since: DateTime<Utc>,
    ) -> Result<Vec<Vec<u8>>> {
        self.document_persistence.get_updates_since(document_id, since).await
    }

    /// Register user presence
    pub async fn register_user_presence(
        &self,
        document_id: Uuid,
        client_id: String,
        presence: UserPresence,
    ) -> Result<()> {
        let awareness = self.awareness_manager.get_or_create(document_id);
        awareness.set_user_presence(client_id, presence)
    }

    /// Remove user presence
    pub async fn remove_user_presence(
        &self,
        document_id: Uuid,
        client_id: &str,
    ) -> Result<()> {
        let awareness = self.awareness_manager.get_or_create(document_id);
        awareness.remove_user(client_id);
        Ok(())
    }

    /// Cleanup inactive users across all documents
    pub async fn cleanup_inactive_users(&self) -> std::collections::HashMap<Uuid, Vec<String>> {
        self.awareness_manager.cleanup_all_inactive_users()
    }

    /// Remove document from cache
    pub fn evict_from_cache(&self, document_id: &Uuid) {
        self.document_manager.remove(document_id);
        self.awareness_manager.remove(document_id);
    }
}