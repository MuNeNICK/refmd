
use std::sync::Arc;
use dashmap::DashMap;
use parking_lot::RwLock;
use uuid::Uuid;
use yrs::{Doc, Options, Transact, Update, StateVector, Text, GetString, ReadTxn};
use yrs::updates::encoder::Encode;
use yrs::updates::decoder::Decode;
use chrono::{DateTime, Utc};

use crate::error::Result;

/// CRDT document manager that handles Y.Doc instances
pub struct DocumentManager {
    /// Cache of loaded documents
    documents: Arc<DashMap<Uuid, Arc<RwLock<CrdtDocument>>>>,
}

impl DocumentManager {
    pub fn new() -> Self {
        Self {
            documents: Arc::new(DashMap::new()),
        }
    }

    /// Get or create a document
    pub fn get_or_create(&self, document_id: Uuid) -> Arc<RwLock<CrdtDocument>> {
        self.documents
            .entry(document_id)
            .or_insert_with(|| Arc::new(RwLock::new(CrdtDocument::new_with_content(document_id))))
            .clone()
    }

    /// Remove a document from cache
    pub fn remove(&self, document_id: &Uuid) -> Option<Arc<RwLock<CrdtDocument>>> {
        self.documents.remove(document_id).map(|(_, doc)| doc)
    }

    /// Get document if exists in cache
    pub fn get(&self, document_id: &Uuid) -> Option<Arc<RwLock<CrdtDocument>>> {
        self.documents.get(document_id).map(|entry| entry.value().clone())
    }

    
    /// Get all document IDs currently in cache
    pub fn get_all_document_ids(&self) -> Vec<Uuid> {
        self.documents.iter().map(|entry| *entry.key()).collect()
    }
}

/// CRDT document wrapper
pub struct CrdtDocument {
    id: Uuid,
    doc: Doc,
    last_modified: DateTime<Utc>,
}

impl CrdtDocument {
    pub fn new(id: Uuid) -> Self {
        let mut options = Options::default();
        options.client_id = rand::random();
        
        Self {
            id,
            doc: Doc::with_options(options),
            last_modified: Utc::now(),
        }
    }
    
    /// Create new document with initialized content field
    pub fn new_with_content(id: Uuid) -> Self {
        let doc = Self::new(id);
        // Initialize the content text field to ensure proper sync
        let _ = doc.doc.get_or_insert_text("content");
        doc
    }

    /// Create from existing state
    pub fn from_state(id: Uuid, state: &[u8]) -> Result<Self> {
        let mut doc = Self::new(id);
        doc.apply_update(state)?;
        Ok(doc)
    }

    /// Get document ID
    pub fn id(&self) -> Uuid {
        self.id
    }


    /// Get the main text content
    pub fn get_text(&self) -> yrs::TextRef {
        self.doc.get_or_insert_text("content")
    }

    /// Get document content as markdown string
    pub fn get_content(&self) -> Result<String> {
        let text = self.get_text();
        Ok(text.get_string(&self.doc.transact()))
    }

    /// Set document content from markdown string
    pub fn set_content(&mut self, content: &str) -> Result<()> {
        let text = self.get_text();
        let mut txn = self.doc.transact_mut();
        
        // Clear existing content
        let len = text.len(&txn);
        if len > 0 {
            text.remove_range(&mut txn, 0, len);
        }
        
        // Insert new content
        text.insert(&mut txn, 0, content);
        self.last_modified = Utc::now();
        
        Ok(())
    }

    /// Apply an update to the document
    pub fn apply_update(&mut self, update: &[u8]) -> Result<()> {
        self.doc.transact_mut().apply_update(Update::decode_v1(update)?)?;
        self.last_modified = Utc::now();
        Ok(())
    }

    /// Get the current state as an update
    pub fn get_state_as_update(&self) -> Result<Vec<u8>> {
        let txn = self.doc.transact();
        let sv = StateVector::default();
        Ok(txn.encode_state_as_update_v1(&sv))
    }

    /// Get update since a given state
    pub fn get_update_since(&self, state_vector: &[u8]) -> Result<Vec<u8>> {
        let sv = StateVector::decode_v1(state_vector)?;
        let txn = self.doc.transact();
        Ok(txn.encode_diff_v1(&sv))
    }

    /// Get the state vector
    pub fn get_state_vector(&self) -> Vec<u8> {
        let txn = self.doc.transact();
        txn.state_vector().encode_v1()
    }

    /// Get last modified time
    pub fn last_modified(&self) -> DateTime<Utc> {
        self.last_modified
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_creation() {
        let doc_id = Uuid::new_v4();
        let doc = CrdtDocument::new(doc_id);
        assert_eq!(doc.id(), doc_id);
        assert_eq!(doc.get_content().unwrap(), "");
    }

    #[test]
    fn test_content_operations() {
        let doc_id = Uuid::new_v4();
        let mut doc = CrdtDocument::new(doc_id);
        
        doc.set_content("Hello, world!").unwrap();
        assert_eq!(doc.get_content().unwrap(), "Hello, world!");
        
        doc.set_content("New content").unwrap();
        assert_eq!(doc.get_content().unwrap(), "New content");
    }

    #[test]
    fn test_document_manager() {
        let manager = DocumentManager::new();
        let doc_id = Uuid::new_v4();
        
        // Get or create document
        let doc1 = manager.get_or_create(doc_id);
        assert!(manager.get(&doc_id).is_some());
        
        // Get same document
        let doc2 = manager.get_or_create(doc_id);
        assert!(manager.get(&doc_id).is_some());
        
        // Documents should be the same instance
        {
            let d1 = doc1.read();
            let d2 = doc2.read();
            assert_eq!(d1.id(), d2.id());
        }
        
        // Remove document
        manager.remove(&doc_id);
        assert!(manager.get(&doc_id).is_none());
    }
}