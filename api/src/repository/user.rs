use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::db::models::User;
use crate::error::{Error, Result};

#[derive(Clone)]
pub struct UserRepository {
    pool: Arc<PgPool>,
}

impl UserRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
    
    pub async fn create(&self, email: &str, name: &str, password_hash: &str) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (email, name, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, email, name, password_hash, created_at as "created_at!", updated_at as "updated_at!"
            "#,
            email,
            name,
            password_hash
        )
        .fetch_one(self.pool.as_ref())
        .await?;
        
        Ok(user)
    }
    
    pub async fn get_by_id(&self, user_id: Uuid) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, email, name, password_hash, created_at as "created_at!", updated_at as "updated_at!"
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => Error::NotFound("User not found".to_string()),
            _ => e.into(),
        })?;
        
        Ok(user)
    }
    
    pub async fn get_by_email(&self, email: &str) -> Result<User> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, email, name, password_hash, created_at as "created_at!", updated_at as "updated_at!"
            FROM users
            WHERE email = $1
            "#,
            email
        )
        .fetch_one(self.pool.as_ref())
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