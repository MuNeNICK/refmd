
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use serde_json::Value;
use dashmap::DashMap;

use crate::error::Result;

/// User presence information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: Uuid,
    pub name: String,
    pub color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub last_seen: DateTime<Utc>,
}

/// Cursor position in document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub index: u32,
    pub line: u32,
    pub column: u32,
}

/// Selection range in document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub anchor: CursorPosition,
    pub head: CursorPosition,
}

/// Awareness state for a document
pub struct DocumentAwareness {
    document_id: Uuid,
    states: Arc<RwLock<HashMap<String, UserPresence>>>,
    /// Timeout in seconds for removing inactive users
    timeout_seconds: i64,
}

impl DocumentAwareness {
    pub fn new(document_id: Uuid) -> Self {
        Self {
            document_id,
            states: Arc::new(RwLock::new(HashMap::new())),
            timeout_seconds: 30, // Default 30 seconds timeout
        }
    }

    /// Set user presence
    pub fn set_user_presence(&self, client_id: String, presence: UserPresence) -> Result<()> {
        let mut states = self.states.write();
        states.insert(client_id, presence);
        Ok(())
    }

    /// Update cursor position
    pub fn update_cursor(
        &self,
        client_id: &str,
        cursor: Option<CursorPosition>,
    ) -> Result<()> {
        let mut states = self.states.write();
        if let Some(presence) = states.get_mut(client_id) {
            presence.cursor = cursor;
            presence.last_seen = Utc::now();
        }
        Ok(())
    }

    /// Update selection range
    pub fn update_selection(
        &self,
        client_id: &str,
        selection: Option<SelectionRange>,
    ) -> Result<()> {
        let mut states = self.states.write();
        if let Some(presence) = states.get_mut(client_id) {
            presence.selection = selection;
            presence.last_seen = Utc::now();
        }
        Ok(())
    }

    /// Remove user presence
    pub fn remove_user(&self, client_id: &str) -> Option<UserPresence> {
        let mut states = self.states.write();
        states.remove(client_id)
    }

    /// Get all active users
    pub fn get_active_users(&self) -> Vec<(String, UserPresence)> {
        let states = self.states.read();
        let cutoff = Utc::now() - chrono::Duration::seconds(self.timeout_seconds);
        
        states
            .iter()
            .filter(|(_, presence)| presence.last_seen > cutoff)
            .map(|(id, presence)| (id.clone(), presence.clone()))
            .collect()
    }

    
    /// Get all users
    pub fn get_all_users(&self) -> HashMap<String, UserPresence> {
        let states = self.states.read();
        states.clone()
    }

    /// Clean up inactive users
    pub fn cleanup_inactive_users(&self) -> Vec<String> {
        let mut states = self.states.write();
        let cutoff = Utc::now() - chrono::Duration::seconds(self.timeout_seconds);
        
        let inactive_users: Vec<String> = states
            .iter()
            .filter(|(_, presence)| presence.last_seen <= cutoff)
            .map(|(id, _)| id.clone())
            .collect();
        
        for client_id in &inactive_users {
            states.remove(client_id);
        }
        
        inactive_users
    }


    /// Get awareness state as JSON for broadcasting
    pub fn to_json(&self) -> Value {
        let users = self.get_active_users();
        serde_json::json!({
            "document_id": self.document_id,
            "users": users.into_iter().map(|(id, presence)| {
                serde_json::json!({
                    "client_id": id,
                    "user_id": presence.user_id,
                    "name": presence.name,
                    "color": presence.color,
                    "cursor": presence.cursor,
                    "selection": presence.selection,
                    "last_seen": presence.last_seen
                })
            }).collect::<Vec<_>>()
        })
    }

}

/// Global awareness manager for all documents
pub struct AwarenessManager {
    documents: Arc<DashMap<Uuid, Arc<DocumentAwareness>>>,
}

impl AwarenessManager {
    pub fn new() -> Self {
        Self {
            documents: Arc::new(DashMap::new()),
        }
    }

    /// Get or create awareness for a document
    pub fn get_or_create(&self, document_id: Uuid) -> Arc<DocumentAwareness> {
        self.documents
            .entry(document_id)
            .or_insert_with(|| Arc::new(DocumentAwareness::new(document_id)))
            .clone()
    }

    /// Remove awareness for a document
    pub fn remove(&self, document_id: &Uuid) -> Option<Arc<DocumentAwareness>> {
        self.documents.remove(document_id).map(|(_, awareness)| awareness)
    }

    /// Cleanup all inactive users across all documents
    pub fn cleanup_all_inactive_users(&self) -> HashMap<Uuid, Vec<String>> {
        let mut result = HashMap::new();
        
        for entry in self.documents.iter() {
            let document_id = *entry.key();
            let awareness = entry.value();
            let inactive = awareness.cleanup_inactive_users();
            
            if !inactive.is_empty() {
                result.insert(document_id, inactive);
            }
        }
        
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_presence() {
        let doc_id = Uuid::new_v4();
        let awareness = DocumentAwareness::new(doc_id);
        
        let presence = UserPresence {
            user_id: Uuid::new_v4(),
            name: "Test User".to_string(),
            color: "#ff0000".to_string(),
            cursor: Some(CursorPosition {
                index: 10,
                line: 1,
                column: 5,
            }),
            selection: None,
            last_seen: Utc::now(),
        };
        
        awareness.set_user_presence("client1".to_string(), presence.clone()).unwrap();
        
        let users = awareness.get_active_users();
        assert_eq!(users.len(), 1);
        assert_eq!(users[0].1.name, "Test User");
        
        awareness.remove_user("client1");
        assert_eq!(awareness.get_active_users().len(), 0);
    }

    #[test]
    fn test_awareness_manager() {
        let manager = AwarenessManager::new();
        let doc_id = Uuid::new_v4();
        
        let awareness1 = manager.get_or_create(doc_id);
        let awareness2 = manager.get_or_create(doc_id);
        
        // Should return the same instance
        assert!(Arc::ptr_eq(&awareness1, &awareness2));
    }
}