use std::sync::Arc;
use axum::{
    extract::{State, Path},
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
    services::{
        git_sync::{GitSyncService, GitCommit},
        git_diff::{GitDiffService, DiffResult},
        git_conflict::{GitConflictService, ConflictInfo, MergeResolution},
    },
    utils::encryption::EncryptionService,
    error::{Error},
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
) -> crate::error::Result<Json<GitConfigResponse>> {
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
) -> crate::error::Result<Json<Option<GitConfigResponse>>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    
    let config = git_config_repo.get_by_user_id(auth_user.user_id).await?;
    Ok(Json(config.map(|c| c.into())))
}

// DELETE /api/git/config - Delete git configuration
pub async fn delete_config(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<StatusCode> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    
    git_config_repo.delete(auth_user.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// POST /api/git/sync - Manual sync
pub async fn manual_sync(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<GitSyncResponse>> {
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
) -> crate::error::Result<Json<GitStatus>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(git_config_repo, state.config.upload_dir.clone().into(), &state.config.jwt_secret)?;
    
    let status = git_sync_service.get_status(auth_user.user_id).await?;
    Ok(Json(status))
}

// POST /api/git/init - Initialize repository
pub async fn init_repository(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<serde_json::Value>> {
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
) -> crate::error::Result<Json<Vec<GitSyncLogResponse>>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    
    let limit = 50;
    let logs = git_config_repo.get_sync_logs(auth_user.user_id, limit).await?;
    
    let response: Vec<GitSyncLogResponse> = logs.into_iter().map(|log| log.into()).collect();
    Ok(Json(response))
}

// GET /api/git/commits - Get commit history
pub async fn get_commit_history(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<Vec<GitCommit>>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    let commits = git_sync_service.get_commit_history(auth_user.user_id, Some(50)).await?;
    Ok(Json(commits))
}

// GET /api/git/commits/file/{file_path:.*} - Get file commit history
pub async fn get_file_commit_history(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(file_path): Path<String>,
) -> crate::error::Result<Json<Vec<GitCommit>>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    let commits = git_sync_service.get_file_history(auth_user.user_id, &file_path, Some(50)).await?;
    Ok(Json(commits))
}

// GET /api/git/diff/files/{file_path:.*} - Get file diff
pub async fn get_file_diff(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(file_path): Path<String>,
) -> crate::error::Result<Json<DiffResult>> {
    let user_dir = std::path::Path::new(&state.config.upload_dir)
        .join(auth_user.user_id.to_string());
    
    // Check if directory exists
    if !user_dir.exists() {
        return Ok(Json(DiffResult {
            file_path,
            diff_lines: vec![],
            old_content: None,
            new_content: None,
        }));
    }
    
    // Check if it's a git repository
    if !user_dir.join(".git").exists() {
        return Ok(Json(DiffResult {
            file_path,
            diff_lines: vec![],
            old_content: None,
            new_content: None,
        }));
    }
    
    let git_diff_service = GitDiffService::new(&user_dir)?;
    let diff_result = git_diff_service.get_file_diff(&file_path)?;
    
    Ok(Json(diff_result))
}

// GET /api/git/diff/commits/{from}/{to} - Get commit diff
pub async fn get_commit_diff(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((from, to)): Path<(String, String)>,
) -> crate::error::Result<Json<Vec<DiffResult>>> {
    let user_dir = std::path::Path::new(&state.config.upload_dir)
        .join(auth_user.user_id.to_string());
    
    // Check if directory exists
    if !user_dir.exists() {
        return Ok(Json(vec![]));
    }
    
    // Check if it's a git repository
    if !user_dir.join(".git").exists() {
        return Ok(Json(vec![]));
    }
    
    let git_diff_service = GitDiffService::new(&user_dir)?;
    let diff_results = git_diff_service.get_commit_diff(&from, &to)?;
    
    Ok(Json(diff_results))
}

// GET /api/git/diff/staged - Get staged diff
pub async fn get_staged_diff(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<Vec<DiffResult>>> {
    let user_dir = std::path::Path::new(&state.config.upload_dir)
        .join(auth_user.user_id.to_string());
    
    // Check if directory exists
    if !user_dir.exists() {
        return Ok(Json(vec![]));
    }
    
    // Check if it's a git repository
    if !user_dir.join(".git").exists() {
        return Ok(Json(vec![]));
    }
    
    let git_diff_service = GitDiffService::new(&user_dir)?;
    let diff_results = git_diff_service.get_staged_diff()?;
    
    Ok(Json(diff_results))
}

// GET /api/git/diff/working - Get working directory diff
pub async fn get_working_diff(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<Vec<DiffResult>>> {
    let user_dir = std::path::Path::new(&state.config.upload_dir)
        .join(auth_user.user_id.to_string());
    // Check if directory exists
    if !user_dir.exists() {
        return Ok(Json(vec![]));
    }
    
    // Check if it's a git repository
    if !user_dir.join(".git").exists() {
        return Ok(Json(vec![]));
    }
    
    let git_diff_service = GitDiffService::new(&user_dir)?;
    let diff_results = git_diff_service.get_working_diff()?;
    Ok(Json(diff_results))
}

// GET /api/git/diff/commits/{from}/{to}/file/{file_path:.*} - Get file-specific commit diff
pub async fn get_file_commit_diff(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((from, to, file_path)): Path<(String, String, String)>,
) -> crate::error::Result<Json<DiffResult>> {
    let user_dir = std::path::Path::new(&state.config.upload_dir)
        .join(auth_user.user_id.to_string());
    
    // Check if directory exists
    if !user_dir.exists() {
        return Ok(Json(DiffResult {
            file_path: file_path.clone(),
            diff_lines: vec![],
            old_content: None,
            new_content: None,
        }));
    }
    
    // Check if it's a git repository
    if !user_dir.join(".git").exists() {
        return Ok(Json(DiffResult {
            file_path: file_path.clone(),
            diff_lines: vec![],
            old_content: None,
            new_content: None,
        }));
    }
    
    // Remove user_id prefix from file_path if present
    let cleaned_path = if file_path.starts_with(&format!("{}/", auth_user.user_id)) {
        file_path.strip_prefix(&format!("{}/", auth_user.user_id)).unwrap().to_string()
    } else {
        file_path.clone()
    };
    
    tracing::info!("File commit diff request - original: {}, cleaned: {}, from: {}, to: {}", 
        file_path, cleaned_path, from, to);
    
    let git_diff_service = GitDiffService::new(&user_dir)?;
    let diff_result = git_diff_service.get_file_commit_diff(&from, &to, &cleaned_path)?;
    
    Ok(Json(diff_result))
}

// GET /api/git/conflicts - Get current conflicts
pub async fn get_conflicts(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<ConflictInfo>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    let conflicts = git_sync_service.get_conflicts(auth_user.user_id).await?;
    Ok(Json(conflicts))
}

// POST /api/git/conflicts/resolve - Resolve a conflict
pub async fn resolve_conflict(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(resolution): Json<MergeResolution>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_conflict_service = GitConflictService::new(
        state.config.upload_dir.clone().into()
    );
    
    git_conflict_service.resolve_conflict(auth_user.user_id, resolution).await?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Conflict resolved successfully"
    })))
}

// POST /api/git/conflicts/abort - Abort merge with conflicts
pub async fn abort_merge(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_conflict_service = GitConflictService::new(
        state.config.upload_dir.clone().into()
    );
    
    git_conflict_service.abort_merge(auth_user.user_id).await?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Merge aborted successfully"
    })))
}

// POST /api/git/pull - Pull from remote with conflict detection
pub async fn pull_from_remote(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    match git_sync_service.pull_from_remote(auth_user.user_id).await {
        Ok(_) => {
            Ok(Json(serde_json::json!({
                "success": true,
                "message": "Pull completed successfully",
                "has_conflicts": false
            })))
        },
        Err(e) => {
            if e.to_string().contains("conflicts detected") {
                // Get conflict details
                let conflicts = git_sync_service.get_conflicts(auth_user.user_id).await?;
                Ok(Json(serde_json::json!({
                    "success": false,
                    "message": "Pull completed with conflicts",
                    "has_conflicts": true,
                    "conflicts": conflicts
                })))
            } else {
                Err(e)
            }
        }
    }
}

// .gitignore endpoints
pub async fn create_gitignore(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    git_sync_service.create_default_gitignore(auth_user.user_id).await?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Default .gitignore created"
    })))
}

#[derive(Deserialize)]
pub struct AddGitignoreRequest {
    patterns: Vec<String>,
}

pub async fn add_gitignore_patterns(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<AddGitignoreRequest>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    git_sync_service.add_to_gitignore(auth_user.user_id, payload.patterns).await?;
    
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Patterns added to .gitignore"
    })))
}

pub async fn get_gitignore_patterns(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    let patterns = git_sync_service.get_gitignore_patterns(auth_user.user_id).await?;
    
    Ok(Json(serde_json::json!({
        "patterns": patterns
    })))
}

#[derive(Deserialize)]
pub struct CheckIgnoredRequest {
    path: String,
}

pub async fn check_path_ignored(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<CheckIgnoredRequest>,
) -> crate::error::Result<Json<serde_json::Value>> {
    let git_config_repo = Arc::new(GitConfigRepository::new(state.db_pool.clone()));
    let git_sync_service = GitSyncService::new(
        git_config_repo,
        state.config.upload_dir.clone().into(),
        &state.config.jwt_secret
    )?;
    
    let is_ignored = git_sync_service.is_path_ignored(auth_user.user_id, &payload.path).await?;
    
    Ok(Json(serde_json::json!({
        "path": payload.path,
        "is_ignored": is_ignored
    })))
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
        .route("/commits", get(get_commit_history))
        .route("/commits/file/*file_path", get(get_file_commit_history))
        .route("/pull", post(pull_from_remote))
        .route("/conflicts", get(get_conflicts))
        .route("/conflicts/resolve", post(resolve_conflict))
        .route("/conflicts/abort", post(abort_merge))
        .route("/diff/files/*file_path", get(get_file_diff))
        .route("/diff/commits/:from/:to", get(get_commit_diff))
        .route("/diff/commits/:from/:to/file/*file_path", get(get_file_commit_diff))
        .route("/diff/staged", get(get_staged_diff))
        .route("/diff/working", get(get_working_diff))
        .route("/gitignore", post(create_gitignore))
        .route("/gitignore/patterns", post(add_gitignore_patterns))
        .route("/gitignore/patterns", get(get_gitignore_patterns))
        .route("/gitignore/check", post(check_path_ignored))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}