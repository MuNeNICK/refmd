use sqlx::PgPool;
use refmd_api::state::AppState;
use refmd_api::config::Config;

pub async fn setup_test_db() -> PgPool {
    // TODO: Set up test database
    todo!("Implement test database setup")
}

pub fn create_test_app_state() -> std::sync::Arc<AppState> {
    let config = Config {
        database_url: "postgres://test:test@localhost/test".to_string(),
        port: 8080,
        jwt_secret: "test-secret".to_string(),
        jwt_expiry: 3600,
        refresh_token_expiry: 604800,
        bcrypt_cost: 4,
        upload_max_size: 10485760,
        upload_dir: "./test_uploads".to_string(),
    };
    
    let db_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy(&config.database_url)
        .expect("Failed to create test db pool");
    
    AppState::new(config, db_pool)
}