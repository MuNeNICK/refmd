
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use uuid::Uuid;
use crate::error::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}

impl Claims {
    pub fn new(user_id: Uuid, email: String, expiry_seconds: i64) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            email,
            iat: now.timestamp(),
            exp: (now + Duration::seconds(expiry_seconds)).timestamp(),
        }
    }
    
    pub fn user_id(&self) -> Uuid {
        self.sub
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Clone)]
pub struct JwtService {
    secret: String,
    access_token_expiry: i64,  // in seconds
    refresh_token_expiry: i64, // in seconds
}

impl JwtService {
    pub fn new(secret: String, access_token_expiry: i64, refresh_token_expiry: i64) -> Self {
        Self {
            secret,
            access_token_expiry,
            refresh_token_expiry,
        }
    }
    
    pub fn generate_token_pair(&self, user_id: Uuid, email: String) -> Result<TokenPair> {
        let access_token = self.generate_token(user_id, email.clone(), self.access_token_expiry)?;
        let refresh_token = self.generate_token(user_id, email, self.refresh_token_expiry)?;
        
        Ok(TokenPair {
            access_token,
            refresh_token,
        })
    }
    
    pub fn generate_token(&self, user_id: Uuid, email: String, expiry_seconds: i64) -> Result<String> {
        let claims = Claims::new(user_id, email, expiry_seconds);
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_ref()),
        )?;
        Ok(token)
    }
    
    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_ref()),
            &Validation::default(),
        )?;
        Ok(token_data.claims)
    }
}

// Backwards compatibility functions
pub fn generate_token(user_id: Uuid, secret: &str, expiry_seconds: i64) -> Result<String> {
    let service = JwtService::new(secret.to_string(), expiry_seconds, expiry_seconds);
    service.generate_token(user_id, String::new(), expiry_seconds)
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims> {
    let service = JwtService::new(secret.to_string(), 0, 0);
    service.verify_token(token)
}