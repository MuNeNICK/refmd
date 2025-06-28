use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::db::models::User;
use crate::error::{Error, Result};
use crate::utils::retry::retry_db;

#[derive(Clone)]
pub struct UserRepository {
    pool: Arc<PgPool>,
}

impl UserRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
    
    /// Generate a username from email address
    /// Takes the part before @ and removes non-alphanumeric characters
    fn generate_username_from_email(email: &str) -> String {
        let username_part = email.split('@').next().unwrap_or("user");
        let cleaned = username_part
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>()
            .to_lowercase();
        
        // Ensure username is not empty and follows the format requirements
        if cleaned.is_empty() {
            "user".to_string()
        } else {
            cleaned
        }
    }
    
    pub async fn create(&self, email: &str, name: &str, password_hash: &str, username: &str) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (email, name, username, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, name, username, password_hash, created_at as "created_at!", updated_at as "updated_at!"
            "#,
            email,
            name,
            username,
            password_hash
        )
        .fetch_one(self.pool.as_ref())
        .await?;
        
        Ok(user)
    }
    
    pub async fn get_by_id(&self, user_id: Uuid) -> Result<User> {
        let pool = self.pool.clone();
        let user = retry_db(|| async {
            sqlx::query_as!(
                User,
                r#"
                SELECT id, email, name, username, password_hash, created_at as "created_at!", updated_at as "updated_at!"
                FROM users
                WHERE id = $1
                "#,
                user_id
            )
            .fetch_one(pool.as_ref())
            .await
        })
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("User not found".to_string()),
            _ => e.into(),
        })?;
        
        Ok(user)
    }
    
    pub async fn get_by_email(&self, email: &str) -> Result<User> {
        let pool = self.pool.clone();
        let email = email.to_string();
        let user = retry_db(move || {
            let pool = pool.clone();
            let email = email.clone();
            async move {
                sqlx::query_as!(
                    User,
                    r#"
                    SELECT id, email, name, username, password_hash, created_at as "created_at!", updated_at as "updated_at!"
                    FROM users
                    WHERE email = $1
                    "#,
                    email
                )
                .fetch_one(pool.as_ref())
                .await
            }
        })
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("User not found".to_string()),
            _ => e.into(),
        })?;
        
        Ok(user)
    }
    
    pub async fn email_exists(&self, email: &str) -> Result<bool> {
        let exists = sqlx::query!(
            r#"
            SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists
            "#,
            email
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .exists
        .unwrap_or(false);
        
        Ok(exists)
    }
    
    pub async fn name_exists(&self, name: &str) -> Result<bool> {
        let exists = sqlx::query!(
            r#"
            SELECT EXISTS(SELECT 1 FROM users WHERE name = $1) as exists
            "#,
            name
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .exists
        .unwrap_or(false);
        
        Ok(exists)
    }
    
    pub async fn username_exists(&self, username: &str) -> Result<bool> {
        let exists = sqlx::query!(
            r#"
            SELECT EXISTS(SELECT 1 FROM users WHERE username = $1) as exists
            "#,
            username
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .exists
        .unwrap_or(false);
        
        Ok(exists)
    }
    
    pub async fn save_refresh_token(&self, user_id: Uuid, token: &str, expires_at: DateTime<Utc>) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            "#,
            user_id,
            token,
            expires_at
        )
        .execute(self.pool.as_ref())
        .await?;
        
        Ok(())
    }
    
    pub async fn validate_refresh_token(&self, token: &str) -> Result<Uuid> {
        let result = sqlx::query!(
            r#"
            SELECT user_id
            FROM refresh_tokens
            WHERE token = $1 AND expires_at > NOW()
            "#,
            token
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::Unauthorized,
            _ => e.into(),
        })?;
        
        Ok(result.user_id)
    }
    
    pub async fn delete_refresh_token(&self, token: &str) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM refresh_tokens
            WHERE token = $1
            "#,
            token
        )
        .execute(self.pool.as_ref())
        .await?;
        
        Ok(())
    }
    
    pub async fn delete_user_refresh_tokens(&self, user_id: Uuid) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM refresh_tokens
            WHERE user_id = $1
            "#,
            user_id
        )
        .execute(self.pool.as_ref())
        .await?;
        
        Ok(())
    }
}