use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)  // Increased from 5 to handle more concurrent requests
        .min_connections(5)   // Keep minimum connections ready
        .acquire_timeout(Duration::from_secs(10))  // Increased from 3 to 10 seconds
        .idle_timeout(Duration::from_secs(600))    // Close idle connections after 10 minutes
        .max_lifetime(Duration::from_secs(1800))   // Max connection lifetime 30 minutes
        .test_before_acquire(true)  // Test connection health before use
        .connect(database_url)
        .await
}