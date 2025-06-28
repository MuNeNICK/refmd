
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Tracks which documents each socket is connected to
#[derive(Clone)]
pub struct ConnectionTracker {
    /// Map from socket ID to set of document IDs
    socket_documents: Arc<DashMap<String, Vec<Uuid>>>,
    /// Map from document ID to set of socket IDs
    document_sockets: Arc<DashMap<Uuid, Vec<String>>>,
}

impl ConnectionTracker {
    pub fn new() -> Self {
        Self {
            socket_documents: Arc::new(DashMap::new()),
            document_sockets: Arc::new(DashMap::new()),
        }
    }

    /// Generic helper to get a cloned value from DashMap
    fn get_cloned<K, V>(&self, map: &DashMap<K, V>, key: &K) -> Option<V>
    where
        K: std::hash::Hash + Eq,
        V: Clone,
    {
        map.get(key).map(|value| value.clone())
    }

    /// Record that a socket joined a document
    pub fn join_document(&self, socket_id: &str, document_id: Uuid) {
        // Add document to socket's list
        self.socket_documents
            .entry(socket_id.to_string())
            .and_modify(|docs| {
                if !docs.contains(&document_id) {
                    docs.push(document_id);
                }
            })
            .or_insert_with(|| vec![document_id]);

        // Add socket to document's list
        self.document_sockets
            .entry(document_id)
            .and_modify(|sockets| {
                if !sockets.contains(&socket_id.to_string()) {
                    sockets.push(socket_id.to_string());
                }
            })
            .or_insert_with(|| vec![socket_id.to_string()]);
    }

    /// Record that a socket left a document
    pub fn leave_document(&self, socket_id: &str, document_id: Uuid) {
        // Remove document from socket's list
        if let Some(mut docs) = self.socket_documents.get_mut(socket_id) {
            docs.retain(|&id| id != document_id);
        }

        // Remove socket from document's list
        if let Some(mut sockets) = self.document_sockets.get_mut(&document_id) {
            sockets.retain(|id| id != socket_id);
        }
    }

    /// Get all documents a socket is connected to
    pub fn get_socket_documents(&self, socket_id: &str) -> Vec<Uuid> {
        self.get_cloned(&self.socket_documents, &socket_id.to_string())
            .unwrap_or_default()
    }

    /// Get all sockets connected to a document
    pub fn get_document_sockets(&self, document_id: Uuid) -> Vec<String> {
        self.get_cloned(&self.document_sockets, &document_id)
            .unwrap_or_default()
    }

    /// Remove all entries for a disconnected socket
    pub fn remove_socket(&self, socket_id: &str) -> Vec<Uuid> {
        // Get all documents the socket was in
        let documents = self.get_socket_documents(socket_id);

        // Remove socket from all documents
        for doc_id in &documents {
            self.leave_document(socket_id, *doc_id);
        }

        // Remove the socket entry
        self.socket_documents.remove(socket_id);

        documents
    }

    /// Check if a document has any connected sockets
    pub fn is_document_empty(&self, document_id: Uuid) -> bool {
        self.document_sockets
            .get(&document_id)
            .map(|sockets| sockets.is_empty())
            .unwrap_or(true)
    }
    
    /// Check if a socket is already in a document
    pub fn is_socket_in_document(&self, socket_id: &str, document_id: Uuid) -> bool {
        self.socket_documents
            .get(socket_id)
            .map(|docs| docs.contains(&document_id))
            .unwrap_or(false)
    }
}