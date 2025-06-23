use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub jwt_secret: String,
    pub jwt_expiry: i64,
    pub refresh_token_expiry: i64,
    pub bcrypt_cost: u32,
    pub upload_max_size: usize,
    pub upload_dir: String,
    pub frontend_url: Option<String>,
    pub git_sync_enabled: bool,
    pub git_auto_sync: bool,
    pub git_sync_interval: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://refmd:refmd@localhost:5432/refmd".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8888".to_string())
                .parse()?,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-secret-key".to_string()),
            jwt_expiry: std::env::var("JWT_EXPIRY")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()?,
            refresh_token_expiry: std::env::var("REFRESH_TOKEN_EXPIRY")
                .unwrap_or_else(|_| "604800".to_string())
                .parse()?,
            bcrypt_cost: std::env::var("BCRYPT_COST")
                .unwrap_or_else(|_| "12".to_string())
                .parse()?,
            upload_max_size: std::env::var("UPLOAD_MAX_SIZE")
                .unwrap_or_else(|_| "10485760".to_string()) // 10MB
                .parse()?,
            upload_dir: std::env::var("UPLOAD_DIR")
                .unwrap_or_else(|_| "./uploads".to_string()),
            frontend_url: std::env::var("FRONTEND_URL").ok(),
            git_sync_enabled: std::env::var("GIT_SYNC_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            git_auto_sync: std::env::var("GIT_AUTO_SYNC")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            git_sync_interval: std::env::var("GIT_SYNC_INTERVAL")
                .unwrap_or_else(|_| "300".to_string())
                .parse()
                .unwrap_or(300),
        })
    }
}