use std::sync::Arc;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    Extension,
    routing::{get, post, delete},
    Router,
    middleware::from_fn_with_state,
};
use serde::Deserialize;

use crate::{
    entities::{
        git_config::{
            CreateGitConfigRequest, UpdateGitConfigRequest, GitConfigResponse, 
            GitSyncResponse, GitStatus, GitSyncLogResponse
        },
    },
    repository::GitConfigRepository,
    services::git_sync::GitSyncService,
    utils::encryption::EncryptionService,
    error::{Error, Result},
    state::AppState,
    middleware::auth::{auth_middleware, AuthUser},
};

#[derive(Deserialize)]
pub struct SyncQuery {
    pub message: Option<String>,
    pub force: Option<bool>,
}

#[derive(Deserialize)]
pub struct LogsQuery {
    pub limit: Option<i32>,
}

// POST /api/git/config - Create or update git configuration
pub async fn create_or_update_config(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(request): Json<CreateGitConfigRequest>,
) -> Result<Json<GitConfigResponse>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let encryption_service = EncryptionService::new(&state.config.jwt_secret)?;
    
    // Create a mutable copy of the request to encrypt auth data
    let mut encrypted_request = request;
    
    // Validate auth_type
    if encrypted_request.auth_type != "ssh" && encrypted_request.auth_type != "token" {
        return Err(Error::BadRequest("auth_type must be 'ssh' or 'token'".to_string()));
    }

    // Validate auth_data structure based on auth_type
    match encrypted_request.auth_type.as_str() {
        "ssh" => {
            if let Some(private_key_value) = encrypted_request.auth_data.get("private_key") {
                if let Some(private_key) = private_key_value.as_str() {
                    // Validate that it looks like an SSH private key
                    if !private_key.contains("BEGIN") || !private_key.contains("PRIVATE KEY") {
                        return Err(Error::BadRequest("Invalid SSH private key format".to_string()));
                    }
                } else {
                    return Err(Error::BadRequest("SSH auth requires 'private_key' to be a string".to_string()));
                }
            } else {
                return Err(Error::BadRequest("SSH auth requires 'private_key' in auth_data".to_string()));
            }
        },
        "token" => {
            if !encrypted_request.auth_data.get("token").and_then(|v| v.as_str()).is_some() {
                return Err(Error::BadRequest("Token auth requires 'token' in auth_data".to_string()));
            }
        },
        _ => unreachable!(),
    }

    // Encrypt sensitive auth data before storing
    encrypted_request.encrypt_auth_data(&encryption_service)?;

    // Check if config already exists
    if let Some(_existing_config) = git_config_repo.get_by_user_id(auth_user.user_id).await? {
        // Update existing config
        let update_request = UpdateGitConfigRequest {
            repository_url: Some(encrypted_request.repository_url),
            branch_name: encrypted_request.branch_name,
            auth_type: Some(encrypted_request.auth_type),
            auth_data: Some(encrypted_request.auth_data),
            auto_sync: encrypted_request.auto_sync,
        };
        
        // Note: auth_data is already encrypted in encrypted_request
        
        let updated_config = git_config_repo.update(auth_user.user_id, update_request).await?;
        Ok(Json(updated_config.into()))
    } else {
        // Create new config
        let new_config = git_config_repo.create(auth_user.user_id, encrypted_request).await?;
        Ok(Json(new_config.into()))
    }
}

// GET /api/git/config - Get git configuration
pub async fn get_config(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Option<GitConfigResponse>>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    
    let config = git_config_repo.get_by_user_id(auth_user.user_id).await?;
    Ok(Json(config.map(|c| c.into())))
}

// DELETE /api/git/config - Delete git configuration
pub async fn delete_config(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<StatusCode> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    
    git_config_repo.delete(auth_user.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// POST /api/git/sync - Manual sync
pub async fn manual_sync(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<GitSyncResponse>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(git_config_repo, state.config.upload_dir.clone().into(), &state.config.jwt_secret)?;
    
    let sync_result = git_sync_service.sync(
        auth_user.user_id,
        None,
        false,
    ).await?;
    
    Ok(Json(sync_result))
}

// GET /api/git/status - Get git status
pub async fn get_status(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<GitStatus>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(git_config_repo, state.config.upload_dir.clone().into(), &state.config.jwt_secret)?;
    
    let status = git_sync_service.get_status(auth_user.user_id).await?;
    Ok(Json(status))
}

// POST /api/git/init - Initialize repository
pub async fn init_repository(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(git_config_repo, state.config.upload_dir.clone().into(), &state.config.jwt_secret)?;
    
    git_sync_service.init_repository(auth_user.user_id).await?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Repository initialized successfully"
    })))
}

// GET /api/git/logs - Get sync logs
pub async fn get_sync_logs(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<GitSyncLogResponse>>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    
    let limit = 50;
    let logs = git_config_repo.get_sync_logs(auth_user.user_id, limit).await?;
    
    let response: Vec<GitSyncLogResponse> = logs.into_iter().map(|log| log.into()).collect();
    Ok(Json(response))
}

// Route definitions
pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/config", post(create_or_update_config))
        .route("/config", get(get_config))
        .route("/config", delete(delete_config))
        .route("/init", post(init_repository))
        .route("/sync", post(manual_sync))
        .route("/status", get(get_status))
        .route("/logs", get(get_sync_logs))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}