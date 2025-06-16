
use uuid::Uuid;
use sqlx::{PgPool, Postgres, Transaction};
use chrono::{DateTime, Utc};
use crate::error::Result;
use crate::crdt::document::CrdtDocument;

/// Persistence layer for CRDT documents
pub struct DocumentPersistence {
    pool: PgPool,
}

impl DocumentPersistence {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Save document state to database
    pub async fn save_document(&self, document: &CrdtDocument) -> Result<()> {
        let state = document.get_state_as_update()?;
        let state_vector = document.get_state_vector();
        
        // First try to update
        let result = sqlx::query!(
            r#"
            UPDATE document_updates 
            SET update_data = $2, state_vector = $3, created_at = $4
            WHERE document_id = $1
            "#,
            document.id(),
            &state,
            &state_vector,
            Utc::now()
        )
        .execute(&self.pool)
        .await?;
        
        // If no rows were updated, insert
        if result.rows_affected() == 0 {
            sqlx::query!(
                r#"
                INSERT INTO document_updates (document_id, update_data, state_vector, created_at)
                VALUES ($1, $2, $3, $4)
                "#,
                document.id(),
                &state,
                &state_vector,
                Utc::now()
            )
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Load document state from database
    pub async fn load_document(&self, document_id: Uuid) -> Result<Option<CrdtDocument>> {
        let result = sqlx::query!(
            r#"
            SELECT update_data 
            FROM document_updates 
            WHERE document_id = $1
            "#,
            document_id
        )
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some(row) => {
                let doc = CrdtDocument::from_state(document_id, &row.update_data)?;
                Ok(Some(doc))
            }
            None => Ok(None),
        }
    }

    /// Save incremental update
    pub async fn save_update(
        &self,
        document_id: Uuid,
        update: &[u8],
        tx: &mut Transaction<'_, Postgres>,
    ) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO document_update_history (document_id, update_data, created_at)
            VALUES ($1, $2, $3)
            "#,
            document_id,
            update,
            Utc::now()
        )
        .execute(&mut **tx)
        .await?;

        Ok(())
    }
    
    /// Save incremental update with automatic transaction
    pub async fn save_update_auto(&self, document_id: Uuid, update: &[u8]) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        
        self.save_update(document_id, update, &mut tx).await?;
        
        tx.commit().await?;
        Ok(())
    }

    /// Get updates since a given timestamp
    pub async fn get_updates_since(
        &self,
        document_id: Uuid,
        since: DateTime<Utc>,
    ) -> Result<Vec<Vec<u8>>> {
        let rows = sqlx::query!(
            r#"
            SELECT update_data
            FROM document_update_history
            WHERE document_id = $1 AND created_at > $2
            ORDER BY created_at ASC
            "#,
            document_id,
            since
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|row| row.update_data).collect())
    }



    /// Sync CRDT document content back to the main documents table
    pub async fn sync_to_documents_table(&self, document: &CrdtDocument) -> Result<()> {
        let state = document.get_state_as_update()?;
        
        sqlx::query!(
            r#"
            UPDATE documents
            SET 
                crdt_state = $2,
                updated_at = NOW(),
                last_edited_at = NOW()
            WHERE id = $1
            "#,
            document.id(),
            &state
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

}

/// Helper functions for serialization
pub mod serialization {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

    /// Serialize update to base64 string for JSON transport
    pub fn update_to_base64(update: &[u8]) -> String {
        BASE64.encode(update)
    }


}

#[cfg(test)]
mod tests {
    use super::serialization;

    #[test]
    fn test_serialization() {
        use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
        
        let data = vec![1, 2, 3, 4, 5];
        let encoded = serialization::update_to_base64(&data);
        let decoded = BASE64.decode(&encoded).unwrap();
        assert_eq!(data, decoded);
    }
}