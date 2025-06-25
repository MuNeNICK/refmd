use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::{
    error::Result,
    services::link_parser::LinkParser,
    services::link_resolver::LinkResolver,
};

#[derive(Debug, Clone)]
pub struct StoredDocumentLink {
    pub id: Uuid,
    pub source_document_id: Uuid,
    pub target_document_id: Uuid,
    pub link_type: String,
    pub link_text: Option<String>,
    pub position_start: Option<i32>,
    pub position_end: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct DocumentLinkInfo {
    pub document_id: Uuid,
    pub title: String,
    pub document_type: String,
    pub file_path: Option<String>,
    pub link_type: String,
    pub link_text: Option<String>,
    pub link_count: i64,
}

#[derive(Debug, Clone)]
pub struct OutgoingLinkInfo {
    pub document_id: Uuid,
    pub title: String,
    pub document_type: String,
    pub file_path: Option<String>,
    pub link_type: String,
    pub link_text: Option<String>,
    pub position_start: Option<i32>,
    pub position_end: Option<i32>,
}

pub struct DocumentLinksService {
    pool: Arc<PgPool>,
    pub link_resolver: Arc<LinkResolver>,
}

impl DocumentLinksService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        let link_resolver = Arc::new(LinkResolver::new(pool.clone()));
        Self { pool, link_resolver }
    }

    /// Update links for a document based on its content
    pub async fn update_document_links(&self, document_id: Uuid, content: &str) -> Result<()> {
        // Get the document owner from the database
        let owner_id = sqlx::query!(
            "SELECT owner_id FROM documents WHERE id = $1",
            document_id
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .owner_id;
        
        // Parse links from content
        let links = LinkParser::parse_links(content);
        
        // Start a transaction
        let mut tx = self.pool.begin().await?;
        
        // Delete existing links for this document
        sqlx::query!(
            "DELETE FROM document_links WHERE source_document_id = $1",
            document_id
        )
        .execute(&mut *tx)
        .await?;
        
        // Batch resolve targets to avoid N+1 queries
        let targets: Vec<&crate::services::link_parser::LinkTarget> = links.iter().map(|l| &l.target).collect();
        let resolved_docs = self.link_resolver.resolve_targets_batch(&targets, owner_id).await?;

        // Insert resolved links
        for (link, resolved_doc) in links.iter().zip(resolved_docs.iter()) {
            if let Some(target_doc) = resolved_doc {
                // Insert the link
                sqlx::query!(
                    r#"
                    INSERT INTO document_links (
                        source_document_id, target_document_id, link_type, 
                        link_text, position_start, position_end
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (source_document_id, target_document_id, position_start) 
                    DO UPDATE SET 
                        link_type = EXCLUDED.link_type,
                        link_text = EXCLUDED.link_text,
                        position_end = EXCLUDED.position_end,
                        updated_at = NOW()
                    "#,
                    document_id,
                    target_doc.id,
                    link.link_type.as_str(),
                    link.link_text,
                    link.position_start as i32,
                    link.position_end as i32
                )
                .execute(&mut *tx)
                .await?;
            }
        }
        
        // Commit transaction
        tx.commit().await?;
        
        Ok(())
    }

    /// Get all documents that link to a specific document (backlinks)
    pub async fn get_backlinks(&self, document_id: Uuid, user_id: Option<Uuid>) -> Result<Vec<DocumentLinkInfo>> {
        let backlinks = if let Some(user_id) = user_id {
            // Authenticated user - show only documents they own or have access to
            sqlx::query!(
                r#"
                SELECT 
                    d.id as document_id,
                    d.title,
                    d.type as document_type,
                    d.file_path,
                    dl.link_type,
                    dl.link_text,
                    COUNT(*)::BIGINT as link_count
                FROM document_links dl
                JOIN documents d ON d.id = dl.source_document_id
                WHERE dl.target_document_id = $1 
                AND d.owner_id = $2
                GROUP BY d.id, d.title, d.type, d.file_path, dl.link_type, dl.link_text
                ORDER BY link_count DESC, d.title
                "#,
                document_id,
                user_id
            )
            .fetch_all(self.pool.as_ref())
            .await?
        } else {
            // Unauthenticated - only show documents accessible via share tokens
            // This would require additional context about current share token
            // For now, return empty list for unauthenticated users
            Vec::new()
        };
        
        Ok(backlinks
            .into_iter()
            .map(|row| DocumentLinkInfo {
                document_id: row.document_id,
                title: row.title,
                document_type: row.document_type.to_string(),
                file_path: row.file_path,
                link_type: row.link_type,
                link_text: row.link_text,
                link_count: row.link_count.unwrap_or(0),
            })
            .collect())
    }

    /// Get all documents linked from a specific document (outgoing links)
    pub async fn get_outgoing_links(&self, document_id: Uuid, user_id: Option<Uuid>) -> Result<Vec<OutgoingLinkInfo>> {
        let links = if let Some(user_id) = user_id {
            // Authenticated user - show only target documents they have access to
            sqlx::query!(
                r#"
                SELECT 
                    d.id as document_id,
                    d.title,
                    d.type as document_type,
                    d.file_path,
                    dl.link_type,
                    dl.link_text,
                    dl.position_start,
                    dl.position_end
                FROM document_links dl
                JOIN documents d ON d.id = dl.target_document_id
                WHERE dl.source_document_id = $1
                AND d.owner_id = $2
                ORDER BY dl.position_start
                "#,
                document_id,
                user_id
            )
            .fetch_all(self.pool.as_ref())
            .await?
        } else {
            // Unauthenticated - return empty list for now
            Vec::new()
        };
        
        Ok(links
            .into_iter()
            .map(|row| OutgoingLinkInfo {
                document_id: row.document_id,
                title: row.title,
                document_type: row.document_type.to_string(),
                file_path: row.file_path,
                link_type: row.link_type,
                link_text: row.link_text,
                position_start: row.position_start,
                position_end: row.position_end,
            })
            .collect())
    }

    /// Find broken links (links pointing to non-existent documents)
    pub async fn find_broken_links(&self, _owner_id: Uuid) -> Result<Vec<BrokenLink>> {
        // This would need a more complex implementation to track unresolved links
        // For now, return empty as all links are validated on insert
        Ok(vec![])
    }

    /// Update links when a document is renamed
    pub async fn update_links_on_rename(&self, document_id: Uuid, old_title: &str, new_title: &str) -> Result<()> {
        // Find all documents that link to this document by title
        let affected_docs = self.link_resolver.get_affected_by_rename(document_id).await?;
        
        // Update each affected document
        for source_doc_id in affected_docs {
            // This would require fetching the document content, updating links, and saving
            // For now, we'll just update the link_text in the database
            sqlx::query!(
                r#"
                UPDATE document_links
                SET link_text = CASE 
                    WHEN link_text = $2 THEN $3
                    ELSE link_text
                END,
                updated_at = NOW()
                WHERE source_document_id = $1 AND target_document_id = $4
                "#,
                source_doc_id,
                old_title,
                new_title,
                document_id
            )
            .execute(self.pool.as_ref())
            .await?;
        }
        
        Ok(())
    }

    /// Get link statistics for a document
    pub async fn get_link_stats(&self, document_id: Uuid) -> Result<LinkStats> {
        let backlink_count = sqlx::query!(
            "SELECT COUNT(DISTINCT source_document_id)::BIGINT as count FROM document_links WHERE target_document_id = $1",
            document_id
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .count
        .unwrap_or(0);
        
        let outgoing_count = sqlx::query!(
            "SELECT COUNT(DISTINCT target_document_id)::BIGINT as count FROM document_links WHERE source_document_id = $1",
            document_id
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .count
        .unwrap_or(0);
        
        Ok(LinkStats {
            backlink_count: backlink_count as usize,
            outgoing_link_count: outgoing_count as usize,
        })
    }
}

#[derive(Debug, Clone)]
pub struct BrokenLink {
    pub source_document_id: Uuid,
    pub source_title: String,
    pub link_text: String,
    pub position: usize,
}

#[derive(Debug, Clone)]
pub struct LinkStats {
    pub backlink_count: usize,
    pub outgoing_link_count: usize,
}