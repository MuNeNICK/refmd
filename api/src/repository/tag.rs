use anyhow::Result;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

use crate::entities::tag::{Tag, TagWithCount};
use crate::services::tag_parser::TagParser;

pub struct TagRepository {
    pool: Pool<Postgres>,
}

impl TagRepository {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    /// Get or create a tag by name
    pub async fn get_or_create_tag(&self, name: &str) -> Result<Tag> {
        let normalized_name = TagParser::normalize_tag(name);
        
        // First try to get existing tag
        let existing = sqlx::query_as!(
            Tag,
            r#"
            SELECT id, name, created_at
            FROM tags
            WHERE LOWER(name) = LOWER($1)
            "#,
            &normalized_name
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(tag) = existing {
            return Ok(tag);
        }

        // Create new tag if it doesn't exist
        let tag = sqlx::query_as!(
            Tag,
            r#"
            INSERT INTO tags (name)
            VALUES ($1)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, name, created_at
            "#,
            &normalized_name
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(tag)
    }

    /// Get tags for a scrap post
    pub async fn get_scrap_post_tags(&self, scrap_post_id: Uuid) -> Result<Vec<Tag>> {
        let tags = sqlx::query_as!(
            Tag,
            r#"
            SELECT t.id, t.name, t.created_at
            FROM tags t
            INNER JOIN scrap_post_tags spt ON t.id = spt.tag_id
            WHERE spt.scrap_post_id = $1
            ORDER BY t.name
            "#,
            scrap_post_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(tags)
    }

    /// Update tags for a scrap post
    pub async fn update_scrap_post_tags(&self, scrap_post_id: Uuid, tag_names: Vec<String>) -> Result<Vec<Tag>> {
        let mut tx = self.pool.begin().await?;

        // Delete existing tags
        sqlx::query!(
            "DELETE FROM scrap_post_tags WHERE scrap_post_id = $1",
            scrap_post_id
        )
        .execute(&mut *tx)
        .await?;

        let mut tags = Vec::new();

        // Insert new tags
        for tag_name in tag_names {
            if !TagParser::is_valid_tag(&tag_name) {
                continue;
            }

            // Get or create tag
            let normalized_name = TagParser::normalize_tag(&tag_name);
            let tag = sqlx::query_as!(
                Tag,
                r#"
                INSERT INTO tags (name)
                VALUES ($1)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id, name, created_at
                "#,
                &normalized_name
            )
            .fetch_one(&mut *tx)
            .await?;

            // Create association
            sqlx::query!(
                r#"
                INSERT INTO scrap_post_tags (scrap_post_id, tag_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                "#,
                scrap_post_id,
                tag.id
            )
            .execute(&mut *tx)
            .await?;

            tags.push(tag);
        }

        tx.commit().await?;

        Ok(tags)
    }

    /// Get all tags with usage count
    pub async fn get_all_tags_with_count(&self, limit: Option<i64>, offset: Option<i64>) -> Result<(Vec<TagWithCount>, i64)> {
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);

        // Get total count
        let total = sqlx::query_scalar!(
            "SELECT COUNT(DISTINCT id) FROM tags"
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        // Get tags with count
        let tags = sqlx::query_as!(
            TagWithCount,
            r#"
            SELECT 
                t.id,
                t.name,
                t.created_at,
                COUNT(spt.scrap_post_id) as "count!"
            FROM tags t
            LEFT JOIN scrap_post_tags spt ON t.id = spt.tag_id
            GROUP BY t.id, t.name, t.created_at
            ORDER BY COUNT(spt.scrap_post_id) DESC, t.name
            LIMIT $1 OFFSET $2
            "#,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await?;

        Ok((tags, total))
    }

    /// Get scrap posts by tag name
    pub async fn get_scrap_posts_by_tag(&self, tag_name: &str, user_id: Uuid) -> Result<Vec<Uuid>> {
        let normalized_name = TagParser::normalize_tag(tag_name);
        
        let post_ids = sqlx::query!(
            r#"
            SELECT DISTINCT sp.id, sp.created_at
            FROM scrap_posts sp
            INNER JOIN scrap_post_tags spt ON sp.id = spt.scrap_post_id
            INNER JOIN tags t ON spt.tag_id = t.id
            INNER JOIN documents d ON sp.document_id = d.id
            WHERE LOWER(t.name) = LOWER($1)
                AND (d.owner_id = $2 OR d.visibility = 'public')
            ORDER BY sp.created_at DESC
            "#,
            &normalized_name,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(post_ids.into_iter().map(|r| r.id).collect())
    }

    /// Delete unused tags
    pub async fn cleanup_unused_tags(&self) -> Result<u64> {
        let result = sqlx::query!(
            r#"
            DELETE FROM tags
            WHERE NOT EXISTS (
                SELECT 1 FROM scrap_post_tags
                WHERE tag_id = tags.id
            )
            "#
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }
}