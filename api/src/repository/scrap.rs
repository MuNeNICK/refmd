use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::db::models::{Document, ScrapPost as DbScrapPost};
use crate::entities::scrap::{CreateScrapRequest, ScrapPost, UpdateScrapRequest};
use crate::error::{Error, Result};

pub struct ScrapRepository;

impl ScrapRepository {
    pub async fn create_scrap(
        pool: &PgPool,
        owner_id: Uuid,
        request: CreateScrapRequest,
    ) -> Result<Document> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let document = sqlx::query_as::<_, Document>(
            r#"
            INSERT INTO documents (id, owner_id, title, type, parent_id, created_at, updated_at)
            VALUES ($1, $2, $3, 'scrap', $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(owner_id)
        .bind(&request.title)
        .bind(request.parent_id)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        Ok(document)
    }

    pub async fn get_scrap_by_id(
        pool: &PgPool,
        id: Uuid,
    ) -> Result<Document> {
        let document = sqlx::query_as::<_, Document>(
            r#"
            SELECT * FROM documents
            WHERE id = $1 AND type = 'scrap'
            "#,
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("Scrap not found".to_string()),
            _ => Error::Database(e),
        })?;

        Ok(document)
    }

    pub async fn get_user_scraps(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<Document>> {
        let documents = sqlx::query_as::<_, Document>(
            r#"
            SELECT * FROM documents
            WHERE owner_id = $1 AND type = 'scrap'
            ORDER BY updated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        Ok(documents)
    }

    pub async fn update_scrap(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
        request: UpdateScrapRequest,
    ) -> Result<Document> {
        let document = if let Some(title) = request.title {
            sqlx::query_as::<_, Document>(
                r#"
                UPDATE documents 
                SET title = $1, updated_at = $2
                WHERE id = $3 AND owner_id = $4 AND type = 'scrap'
                RETURNING *
                "#,
            )
            .bind(title)
            .bind(Utc::now())
            .bind(id)
            .bind(user_id)
            .fetch_one(pool)
            .await
        } else {
            sqlx::query_as::<_, Document>(
                r#"
                UPDATE documents 
                SET updated_at = $1
                WHERE id = $2 AND owner_id = $3 AND type = 'scrap'
                RETURNING *
                "#,
            )
            .bind(Utc::now())
            .bind(id)
            .bind(user_id)
            .fetch_one(pool)
            .await
        }
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("Scrap not found".to_string()),
            _ => Error::Database(e),
        })?;

        Ok(document)
    }

    pub async fn delete_scrap(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        let result = sqlx::query(
            r#"
            DELETE FROM documents
            WHERE id = $1 AND owner_id = $2 AND type = 'scrap'
            "#,
        )
        .bind(id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        if result.rows_affected() == 0 {
            return Err(Error::NotFound("Scrap not found".to_string()));
        }

        Ok(())
    }

    // ScrapPost methods
    pub async fn create_scrap_post(
        pool: &PgPool,
        document_id: Uuid,
        author_id: Uuid,
        content: String,
    ) -> Result<DbScrapPost> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let post = sqlx::query_as::<_, DbScrapPost>(
            r#"
            INSERT INTO scrap_posts (id, document_id, author_id, content, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(document_id)
        .bind(author_id)
        .bind(content)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        Ok(post)
    }

    pub async fn get_scrap_posts(
        pool: &PgPool,
        document_id: Uuid,
    ) -> Result<Vec<ScrapPost>> {
        let posts = sqlx::query(
            r#"
            SELECT sp.*, u.name as author_name
            FROM scrap_posts sp
            LEFT JOIN users u ON sp.author_id = u.id
            WHERE sp.document_id = $1
            ORDER BY sp.created_at ASC
            "#,
        )
        .bind(document_id)
        .fetch_all(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        let posts = posts
            .into_iter()
            .map(|row| ScrapPost {
                id: row.get("id"),
                author_id: row.get("author_id"),
                author_name: row.get("author_name"),
                content: row.get("content"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        Ok(posts)
    }

    pub async fn update_scrap_post(
        pool: &PgPool,
        post_id: Uuid,
        author_id: Uuid,
        content: String,
    ) -> Result<DbScrapPost> {
        let post = sqlx::query_as::<_, DbScrapPost>(
            r#"
            UPDATE scrap_posts
            SET content = $1, updated_at = $2
            WHERE id = $3 AND author_id = $4
            RETURNING *
            "#,
        )
        .bind(content)
        .bind(Utc::now())
        .bind(post_id)
        .bind(author_id)
        .fetch_one(pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("Post not found or unauthorized".to_string()),
            _ => Error::Database(e),
        })?;

        Ok(post)
    }

    pub async fn delete_scrap_post(
        pool: &PgPool,
        post_id: Uuid,
        author_id: Uuid,
    ) -> Result<()> {
        let result = sqlx::query(
            r#"
            DELETE FROM scrap_posts
            WHERE id = $1 AND author_id = $2
            "#,
        )
        .bind(post_id)
        .bind(author_id)
        .execute(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        if result.rows_affected() == 0 {
            return Err(Error::NotFound("Post not found or unauthorized".to_string()));
        }

        Ok(())
    }

    pub async fn check_scrap_access(
        pool: &PgPool,
        document_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool> {
        let result = sqlx::query(
            r#"
            SELECT 1 FROM documents d
            LEFT JOIN shares s ON d.id = s.document_id
            WHERE d.id = $1 AND d.type = 'scrap'
            AND (d.owner_id = $2 OR s.id IS NOT NULL)
            "#,
        )
        .bind(document_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e))?;

        Ok(result.is_some())
    }
}