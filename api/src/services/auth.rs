use std::sync::Arc;
use crate::error::{Error, Result};
use crate::repository::UserRepository;
use crate::utils::jwt::{JwtService, TokenPair};
use crate::utils::password::{hash_password, verify_password};
use crate::db::models::User;
use chrono::{Utc, Duration};
use uuid::Uuid;

pub struct AuthService {
    user_repo: Arc<UserRepository>,
    jwt_service: JwtService,
}

impl AuthService {
    pub fn new(user_repo: Arc<UserRepository>, jwt_service: Arc<JwtService>) -> Self {
        Self {
            user_repo,
            jwt_service: (*jwt_service).clone(),
        }
    }
    
    pub async fn register(&self, email: &str, name: &str, password: &str) -> Result<(TokenPair, User)> {
        // Check if email already exists
        if self.user_repo.email_exists(email).await? {
            return Err(Error::Conflict("Email already registered".to_string()));
        }
        
        // Check if name already exists
        if self.user_repo.name_exists(name).await? {
            return Err(Error::Conflict("Name already taken".to_string()));
        }
        
        // Hash password
        let password_hash = hash_password(password)?;
        
        // Generate username from email for backward compatibility
        let email_prefix = email.split('@').next().unwrap_or("user");
        let username = email_prefix
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>()
            .to_lowercase();
        
        // Create user
        let mut user = self.user_repo.create(email, name, &password_hash, &username).await?;
        
        // Generate tokens
        let tokens = self.jwt_service.generate_token_pair(user.id, user.email.clone())?;
        
        // Save refresh token
        let expires_at = Utc::now() + Duration::days(7);
        self.user_repo.save_refresh_token(user.id, &tokens.refresh_token, expires_at).await?;
        
        // Clear password hash from response
        user.password_hash = String::new();
        
        Ok((tokens, user))
    }
    
    pub async fn login(&self, email: &str, password: &str) -> Result<(TokenPair, User)> {
        // Get user by email
        let mut user = self.user_repo.get_by_email(email).await
            .map_err(|_| Error::Unauthorized)?;
        
        // Verify password
        verify_password(password, &user.password_hash)
            .map_err(|_| Error::Unauthorized)?;
        
        // Generate tokens
        let tokens = self.jwt_service.generate_token_pair(user.id, user.email.clone())?;
        
        // Save refresh token
        let expires_at = Utc::now() + Duration::days(7);
        self.user_repo.save_refresh_token(user.id, &tokens.refresh_token, expires_at).await?;
        
        // Clear password hash from response
        user.password_hash = String::new();
        
        Ok((tokens, user))
    }
    
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<TokenPair> {
        // Validate refresh token
        let user_id = self.user_repo.validate_refresh_token(refresh_token).await?;
        
        // Get user
        let user = self.user_repo.get_by_id(user_id).await?;
        
        // Generate new tokens
        let tokens = self.jwt_service.generate_token_pair(user.id, user.email)?;
        
        // Delete old refresh token
        self.user_repo.delete_refresh_token(refresh_token).await?;
        
        // Save new refresh token
        let expires_at = Utc::now() + Duration::days(7);
        self.user_repo.save_refresh_token(user.id, &tokens.refresh_token, expires_at).await?;
        
        Ok(tokens)
    }
    
    pub async fn logout(&self, user_id: Uuid, refresh_token: Option<&str>) -> Result<()> {
        match refresh_token {
            Some(token) => {
                // Delete specific refresh token
                self.user_repo.delete_refresh_token(token).await?
            }
            None => {
                // Delete all user's refresh tokens
                self.user_repo.delete_user_refresh_tokens(user_id).await?
            }
        }
        
        Ok(())
    }
}