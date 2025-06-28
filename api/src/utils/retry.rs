use std::future::Future;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{warn, debug};

/// Retry configuration
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub exponential_base: f32,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(5),
            exponential_base: 2.0,
        }
    }
}

/// Execute a future with exponential backoff retry logic
pub async fn with_retry<F, Fut, T, E>(
    operation: F,
    config: RetryConfig,
) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut attempt = 0;
    let mut delay = config.initial_delay;

    loop {
        attempt += 1;
        
        match operation().await {
            Ok(result) => {
                if attempt > 1 {
                    debug!("Operation succeeded after {} attempts", attempt);
                }
                return Ok(result);
            }
            Err(err) if attempt >= config.max_attempts => {
                warn!("Operation failed after {} attempts: {}", attempt, err);
                return Err(err);
            }
            Err(err) => {
                warn!("Attempt {} failed: {}, retrying after {:?}", attempt, err, delay);
                sleep(delay).await;
                
                // Calculate next delay with exponential backoff
                delay = Duration::from_millis(
                    (delay.as_millis() as f32 * config.exponential_base) as u64
                ).min(config.max_delay);
            }
        }
    }
}

/// Check if an error is retryable (for database operations)
pub fn is_retryable_db_error(err: &sqlx::Error) -> bool {
    match err {
        // Connection errors
        sqlx::Error::Io(_) => true,
        sqlx::Error::PoolTimedOut => true,
        sqlx::Error::PoolClosed => true,
        
        // Database errors that might be transient
        sqlx::Error::Database(db_err) => {
            let code = db_err.code();
            let is_transient = code.as_ref().map(|c| {
                // PostgreSQL error codes for transient failures
                matches!(c.as_ref(), 
                    "08000" | // connection_exception
                    "08003" | // connection_does_not_exist
                    "08006" | // connection_failure
                    "08001" | // sqlclient_unable_to_establish_sqlconnection
                    "08004" | // sqlserver_rejected_establishment_of_sqlconnection
                    "57P03" | // cannot_connect_now
                    "40001" | // serialization_failure
                    "40P01"   // deadlock_detected
                )
            }).unwrap_or(false);
            
            is_transient || db_err.message().contains("connection")
        }
        
        _ => false,
    }
}

/// Wrapper for retrying database operations
pub async fn retry_db<F, Fut, T>(
    operation: F,
) -> Result<T, sqlx::Error>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, sqlx::Error>>,
{
    let config = RetryConfig::default();
    let mut attempt = 0;
    let mut delay = config.initial_delay;

    loop {
        attempt += 1;
        
        match operation().await {
            Ok(result) => {
                if attempt > 1 {
                    debug!("Database operation succeeded after {} attempts", attempt);
                }
                return Ok(result);
            }
            Err(err) if !is_retryable_db_error(&err) || attempt >= config.max_attempts => {
                if attempt > 1 {
                    warn!("Database operation failed after {} attempts: {}", attempt, err);
                }
                return Err(err);
            }
            Err(err) => {
                warn!("Database attempt {} failed: {}, retrying after {:?}", attempt, err, delay);
                sleep(delay).await;
                
                delay = Duration::from_millis(
                    (delay.as_millis() as f32 * config.exponential_base) as u64
                ).min(config.max_delay);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_retry_success_first_attempt() {
        let result = with_retry(
            || async { Ok::<_, &str>(42) },
            RetryConfig::default(),
        ).await;
        
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_retry_success_after_failures() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = with_retry(
            move || {
                let count = counter_clone.fetch_add(1, Ordering::SeqCst);
                async move {
                    if count < 2 {
                        Err("temporary failure")
                    } else {
                        Ok(42)
                    }
                }
            },
            RetryConfig {
                max_attempts: 3,
                initial_delay: Duration::from_millis(10),
                max_delay: Duration::from_millis(100),
                exponential_base: 2.0,
            },
        ).await;
        
        assert_eq!(result.unwrap(), 42);
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_retry_max_attempts_exceeded() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = with_retry(
            move || {
                counter_clone.fetch_add(1, Ordering::SeqCst);
                async { Err::<i32, _>("permanent failure") }
            },
            RetryConfig {
                max_attempts: 3,
                initial_delay: Duration::from_millis(10),
                max_delay: Duration::from_millis(100),
                exponential_base: 2.0,
            },
        ).await;
        
        assert!(result.is_err());
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }
}