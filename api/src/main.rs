use anyhow::Result;
use axum::Router;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tower_http::timeout::TimeoutLayer;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use tokio::signal;

mod config;
mod crdt;
mod db;
mod entities;
mod error;
mod handlers;
mod middleware;
mod repository;
mod services;
mod socketio;
mod state;
mod utils;

use crate::state::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file if it exists
    dotenvy::dotenv().ok();
    
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "refmd_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = config::Config::from_env()?;
    
    // Initialize database connection
    let db_pool = db::create_pool(&config.database_url).await?;
    
    // Run migrations
    sqlx::migrate!("./migrations").run(&db_pool).await?;
    
    // Create application state
    let app_state = AppState::new(config.clone(), db_pool);
    
    // Build our application with routes
    let app = Router::new()
        .nest("/api", handlers::routes(app_state.clone()))
        .layer(axum::middleware::from_fn(middleware::request_id::request_id_middleware))
        .layer(TimeoutLayer::new(Duration::from_secs(30))) // 30 second timeout for requests
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
    
    // Set up Socket.IO
    let (socketio_layer, socketio_io) = socketioxide::SocketIo::builder()
        .build_layer();
    
    socketio::setup_handlers(socketio_io, app_state.clone());
    
    let app = app.layer(socketio_layer);
    
    // Start batch sync service if enabled
    if let Some(ref batch_sync) = app_state.git_batch_sync_service {
        batch_sync.start().await;
        info!("Git batch sync service started");
    }
    
    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Starting server on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // Serve with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(app_state.clone()))
        .await?;
    
    Ok(())
}

async fn shutdown_signal(app_state: Arc<AppState>) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    
    // Stop batch sync service if running
    if let Some(ref batch_sync) = app_state.git_batch_sync_service {
        batch_sync.stop().await;
        info!("Git batch sync service stopped");
    }

    warn!("Shutdown signal received, starting graceful shutdown...");
    
    // Save all documents before shutting down
    let documents = app_state.document_manager.get_all_document_ids();
    info!("Saving {} documents before shutdown...", documents.len());
    
    for doc_id in documents {
        // Save CRDT state to database
        if let Err(e) = app_state.crdt_service.save_document(doc_id).await {
            warn!("Failed to save document {} during shutdown: {}", doc_id, e);
        }
        
        // Also save to file
        if let Ok(Some(document)) = app_state.document_repository.get_by_id(doc_id).await {
            if let Err(e) = app_state.document_service.save_to_file(&document).await {
                warn!("Failed to save document {} to file during shutdown: {}", doc_id, e);
            } else {
                info!("Saved document {} to file during shutdown", doc_id);
            }
        }
    }
    
    info!("Graceful shutdown complete");
}