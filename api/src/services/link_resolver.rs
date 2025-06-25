use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use crate::{
    error::Result,
    db::models::Document,
    services::link_parser::{LinkTarget, DocumentLink},
};

pub struct LinkResolver {
    pool: Arc<PgPool>,
}

impl LinkResolver {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Resolve a link target to a document
    pub async fn resolve_target(&self, target: &LinkTarget, owner_id: Uuid) -> Result<Option<Document>> {
        match target {
            LinkTarget::Id(id) => {
                // Direct ID lookup
                let document = sqlx::query_as!(
                    Document,
                    r#"
                    SELECT id, owner_id, title, type as "type: _", parent_id, file_path, 
                           crdt_state, version, COALESCE(visibility, 'private') as "visibility!", published_at,
                           created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
                    FROM documents
                    WHERE id = $1 AND (owner_id = $2 OR id IN (
                        SELECT document_id FROM document_permissions 
                        WHERE user_id = $2 AND permission >= 'view'
                    ))
                    "#,
                    id,
                    owner_id
                )
                .fetch_optional(self.pool.as_ref())
                .await?;
                
                Ok(document)
            }
            LinkTarget::Title(title) => {
                // Title lookup - case insensitive
                let document = sqlx::query_as!(
                    Document,
                    r#"
                    SELECT id, owner_id, title, type as "type: _", parent_id, file_path, 
                           crdt_state, version, COALESCE(visibility, 'private') as "visibility!", published_at,
                           created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
                    FROM documents
                    WHERE LOWER(title) = LOWER($1) AND (owner_id = $2 OR id IN (
                        SELECT document_id FROM document_permissions 
                        WHERE user_id = $2 AND permission >= 'view'
                    ))
                    ORDER BY updated_at DESC
                    LIMIT 1
                    "#,
                    title,
                    owner_id
                )
                .fetch_optional(self.pool.as_ref())
                .await?;
                
                Ok(document)
            }
        }
    }

    /// Batch resolve multiple link targets efficiently
    pub async fn resolve_targets_batch(&self, targets: &[&LinkTarget], owner_id: Uuid) -> Result<Vec<Option<Document>>> {
        if targets.is_empty() {
            return Ok(Vec::new());
        }

        // Separate IDs and titles for batch processing
        let mut ids = Vec::new();
        let mut titles = Vec::new();
        let mut target_map = std::collections::HashMap::new();

        for (idx, target) in targets.iter().enumerate() {
            match target {
                LinkTarget::Id(id) => {
                    ids.push(*id);
                    target_map.insert(format!("id:{}", id), idx);
                }
                LinkTarget::Title(title) => {
                    titles.push(title.clone());
                    target_map.insert(format!("title:{}", title.to_lowercase()), idx);
                }
            }
        }

        let mut results = vec![None; targets.len()];

        // Batch fetch by IDs
        if !ids.is_empty() {
            let id_docs = sqlx::query_as!(
                Document,
                r#"
                SELECT id, owner_id, title, type as "type: _", parent_id, file_path, 
                       crdt_state, version, COALESCE(visibility, 'private') as "visibility!", published_at,
                       created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
                FROM documents
                WHERE id = ANY($1) AND (owner_id = $2 OR id IN (
                    SELECT document_id FROM document_permissions 
                    WHERE user_id = $2 AND permission >= 'view'
                ))
                "#,
                &ids,
                owner_id
            )
            .fetch_all(self.pool.as_ref())
            .await?;

            for doc in id_docs {
                if let Some(&idx) = target_map.get(&format!("id:{}", doc.id)) {
                    results[idx] = Some(doc);
                }
            }
        }

        // Batch fetch by titles
        if !titles.is_empty() {
            let title_docs = sqlx::query_as!(
                Document,
                r#"
                SELECT DISTINCT ON (LOWER(title)) 
                       id, owner_id, title, type as "type: _", parent_id, file_path, 
                       crdt_state, version, COALESCE(visibility, 'private') as "visibility!", published_at,
                       created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
                FROM documents
                WHERE LOWER(title) = ANY($1) AND (owner_id = $2 OR id IN (
                    SELECT document_id FROM document_permissions 
                    WHERE user_id = $2 AND permission >= 'view'
                ))
                ORDER BY LOWER(title), updated_at DESC
                "#,
                &titles.iter().map(|t| t.to_lowercase()).collect::<Vec<_>>(),
                owner_id
            )
            .fetch_all(self.pool.as_ref())
            .await?;

            for doc in title_docs {
                if let Some(&idx) = target_map.get(&format!("title:{}", doc.title.to_lowercase())) {
                    results[idx] = Some(doc);
                }
            }
        }

        Ok(results)
    }

    /// Search for documents by partial title match
    pub async fn search_by_title(&self, query: &str, owner_id: Uuid, limit: i64) -> Result<Vec<Document>> {
        let documents = sqlx::query_as!(
            Document,
            r#"
            SELECT id, owner_id, title, type as "type: _", parent_id, file_path, 
                   crdt_state, version, COALESCE(visibility, 'private') as "visibility!", published_at,
                   created_at as "created_at!", updated_at as "updated_at!", last_edited_by, last_edited_at
            FROM documents
            WHERE (LOWER(title) LIKE LOWER($1) OR title ILIKE $2) 
                  AND type IN ('document', 'scrap')
                  AND (owner_id = $3 OR id IN (
                      SELECT document_id FROM document_permissions 
                      WHERE user_id = $3 AND permission >= 'view'
                  ))
            ORDER BY 
                CASE WHEN LOWER(title) = LOWER($4) THEN 0 ELSE 1 END,
                LENGTH(title),
                updated_at DESC
            LIMIT $5
            "#,
            format!("%{}%", query),
            format!("%{}%", query),
            owner_id,
            query,
            limit
        )
        .fetch_all(self.pool.as_ref())
        .await?;
        
        Ok(documents)
    }

    /// Resolve multiple links and return a map of positions to resolved documents
    pub async fn resolve_links(&self, links: &[DocumentLink], owner_id: Uuid) -> Result<Vec<(usize, Option<Document>)>> {
        let mut results = Vec::new();
        
        for (idx, link) in links.iter().enumerate() {
            let document = self.resolve_target(&link.target, owner_id).await?;
            results.push((idx, document));
        }
        
        Ok(results)
    }

    /// Get suggestions for ambiguous references
    pub async fn get_suggestions(&self, partial_title: &str, owner_id: Uuid) -> Result<Vec<DocumentSuggestion>> {
        let documents = self.search_by_title(partial_title, owner_id, 10).await?;
        
        let suggestions: Vec<DocumentSuggestion> = documents
            .into_iter()
            .map(|doc| DocumentSuggestion {
                id: doc.id,
                title: doc.title.clone(),
                document_type: doc.r#type.to_string(),
                path: self.build_document_path(&doc),
                updated_at: doc.updated_at,
            })
            .collect();
        
        Ok(suggestions)
    }

    /// Build a readable path for a document (e.g., "Folder1 / Folder2 / Document")
    fn build_document_path(&self, document: &Document) -> String {
        // For now, just return the title
        // TODO: Build full path by traversing parent_id chain
        document.title.clone()
    }

    /// Check if a document exists and is accessible
    pub async fn document_exists(&self, target: &LinkTarget, owner_id: Uuid) -> Result<bool> {
        let document = self.resolve_target(target, owner_id).await?;
        Ok(document.is_some())
    }

    /// Get all documents that would be affected by renaming a document
    pub async fn get_affected_by_rename(&self, document_id: Uuid) -> Result<Vec<Uuid>> {
        let affected = sqlx::query!(
            r#"
            SELECT DISTINCT source_document_id
            FROM document_links
            WHERE target_document_id = $1
            "#,
            document_id
        )
        .fetch_all(self.pool.as_ref())
        .await?;
        
        Ok(affected.into_iter().map(|r| r.source_document_id).collect())
    }
}

#[derive(Debug, Clone)]
pub struct DocumentSuggestion {
    pub id: Uuid,
    pub title: String,
    pub document_type: String,
    pub path: String,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}