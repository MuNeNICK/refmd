use std::path::{Path, PathBuf};
use std::sync::Arc;
use git2::{Repository, Signature, RemoteCallbacks, Cred, PushOptions, FetchOptions};
use uuid::Uuid;
use chrono::Utc;

use crate::{
    entities::git_config::{GitConfig, GitStatus, GitSyncResponse},
    repository::GitConfigRepository,
    error::{Error, Result},
};

pub struct GitSyncService {
    git_config_repo: Arc<GitConfigRepository>,
    upload_dir: PathBuf,
}

impl GitSyncService {
    pub fn new(git_config_repo: Arc<GitConfigRepository>, upload_dir: PathBuf) -> Self {
        Self {
            git_config_repo,
            upload_dir,
        }
    }

    fn get_user_repo_path(&self, user_id: Uuid) -> PathBuf {
        self.upload_dir.join(user_id.to_string())
    }

    pub async fn init_repository(&self, user_id: Uuid) -> Result<()> {
        let repo_path = self.get_user_repo_path(user_id);
        
        // Create directory if it doesn't exist
        tokio::fs::create_dir_all(&repo_path).await?;

        // Initialize git repository
        match Repository::init(&repo_path) {
            Ok(_) => {
                self.git_config_repo.log_sync_operation(
                    user_id,
                    "init",
                    "success",
                    Some("Repository initialized"),
                    None,
                ).await?;
                Ok(())
            },
            Err(e) => {
                self.git_config_repo.log_sync_operation(
                    user_id,
                    "init",
                    "error",
                    Some(&e.to_string()),
                    None,
                ).await?;
                Err(Error::BadRequest(format!("Failed to initialize repository: {}", e)))
            }
        }
    }

    pub async fn get_status(&self, user_id: Uuid) -> Result<GitStatus> {
        let repo_path = self.get_user_repo_path(user_id);
        let config = self.git_config_repo.get_by_user_id(user_id).await?;

        // Check if repository is initialized
        let repository_initialized = Repository::open(&repo_path).is_ok();
        
        if !repository_initialized {
            return Ok(GitStatus {
                repository_initialized: false,
                has_remote: false,
                current_branch: None,
                uncommitted_changes: 0,
                untracked_files: 0,
                last_sync: None,
                sync_enabled: config.map(|c| c.auto_sync).unwrap_or(false),
            });
        }

        let repo = Repository::open(&repo_path)?;
        
        // Check remote
        let has_remote = repo.remotes().map(|r| r.len() > 0).unwrap_or(false);
        
        // Get current branch
        let current_branch = match repo.head() {
            Ok(head) => head.shorthand().map(|s| s.to_string()),
            Err(_) => None,
        };

        // Get status information (extract values before async call)
        let (uncommitted_changes, untracked_files) = {
            let statuses = match repo.statuses(None) {
                Ok(statuses) => statuses,
                Err(e) => {
                    return Err(Error::BadRequest(format!("Failed to get repository status: {}", e)));
                }
            };
            let untracked = statuses.iter()
                .filter(|s| s.status().is_wt_new())
                .count() as u32;
            let uncommitted = statuses.iter()
                .filter(|s| !s.status().is_wt_new())
                .count() as u32;
            (uncommitted, untracked)
        };

        // Get last sync from logs
        let logs = self.git_config_repo.get_sync_logs(user_id, 1).await?;
        let last_sync = logs.first().map(|log| log.created_at);

        Ok(GitStatus {
            repository_initialized: true,
            has_remote,
            current_branch,
            uncommitted_changes,
            untracked_files,
            last_sync,
            sync_enabled: config.map(|c| c.auto_sync).unwrap_or(false),
        })
    }

    pub async fn add_and_commit(&self, user_id: Uuid, message: Option<String>) -> Result<String> {
        let repo_path = self.get_user_repo_path(user_id);
        
        let commit_message = message.unwrap_or_else(|| {
            format!("Auto-sync documents - {}", Utc::now().format("%Y-%m-%d %H:%M:%S UTC"))
        });

        // Perform git operations in a block to ensure git2 objects are dropped before await
        let commit_hash = {
            let repo = Repository::open(&repo_path)?;

            // Add all files to index
            let mut index = repo.index()?;
            index.add_all(["."], git2::IndexAddOption::DEFAULT, None)?;
            index.write()?;

            let tree_id = index.write_tree()?;
            let tree = repo.find_tree(tree_id)?;

            // Create signature
            let signature = Signature::now("RefMD System", "system@refmd.local")?;

            // Get parent commit if exists
            let parent_commit = match repo.head() {
                Ok(head) => Some(head.peel_to_commit()?),
                Err(_) => None,
            };

            // Create commit
            let commit_id = if let Some(parent) = parent_commit {
                repo.commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    &commit_message,
                    &tree,
                    &[&parent],
                )?
            } else {
                repo.commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    &commit_message,
                    &tree,
                    &[],
                )?
            };

            commit_id.to_string()
        };

        self.git_config_repo.log_sync_operation(
            user_id,
            "commit",
            "success",
            Some(&commit_message),
            Some(&commit_hash),
        ).await?;

        Ok(commit_hash)
    }

    pub async fn push_to_remote(&self, user_id: Uuid) -> Result<()> {
        let config = self.git_config_repo.get_by_user_id(user_id).await?
            .ok_or_else(|| Error::BadRequest("Git config not found".to_string()))?;

        let repo_path = self.get_user_repo_path(user_id);
        
        // Perform git operations in a block to ensure git2 objects are dropped before await
        let push_result = {
            let repo = Repository::open(&repo_path)?;

            // Set up remote if not exists
            let remote_name = "origin";
            let mut remote = match repo.find_remote(remote_name) {
                Ok(remote) => remote,
                Err(_) => {
                    repo.remote(remote_name, &config.repository_url)?
                }
            };

            // Set up authentication
            let mut callbacks = RemoteCallbacks::new();
            self.setup_auth_callbacks(&mut callbacks, &config)?;

            let mut push_options = PushOptions::new();
            push_options.remote_callbacks(callbacks);

            // Get current branch name
            let current_branch = match repo.head() {
                Ok(head) => head.shorthand().unwrap_or("master").to_string(),
                Err(_) => "master".to_string(),
            };
            
            // Push current branch to remote branch
            let refspec = format!("refs/heads/{}:refs/heads/{}", current_branch, config.branch_name);
            remote.push(&[&refspec], Some(&mut push_options))
        };

        match push_result {
            Ok(_) => {
                self.git_config_repo.log_sync_operation(
                    user_id,
                    "push",
                    "success",
                    Some("Successfully pushed to remote"),
                    None,
                ).await?;
                Ok(())
            },
            Err(e) => {
                self.git_config_repo.log_sync_operation(
                    user_id,
                    "push",
                    "error",
                    Some(&e.to_string()),
                    None,
                ).await?;
                Err(Error::BadRequest(format!("Failed to push: {}", e)))
            }
        }
    }

    pub async fn pull_from_remote(&self, user_id: Uuid) -> Result<()> {
        let config = self.git_config_repo.get_by_user_id(user_id).await?
            .ok_or_else(|| Error::BadRequest("Git config not found".to_string()))?;

        let repo_path = self.get_user_repo_path(user_id);
        
        // Perform git operations in a block to ensure git2 objects are dropped before await
        let pull_result = {
            let repo = Repository::open(&repo_path)?;

            // Set up remote
            let remote_name = "origin";
            let mut remote = match repo.find_remote(remote_name) {
                Ok(remote) => remote,
                Err(_) => {
                    repo.remote(remote_name, &config.repository_url)?
                }
            };

            // Set up authentication
            let mut callbacks = RemoteCallbacks::new();
            self.setup_auth_callbacks(&mut callbacks, &config)?;

            let mut fetch_options = FetchOptions::new();
            fetch_options.remote_callbacks(callbacks);

            // Fetch from remote
            remote.fetch(&[&config.branch_name], Some(&mut fetch_options), None)
        };

        match pull_result {
            Ok(_) => {
                self.git_config_repo.log_sync_operation(
                    user_id,
                    "pull",
                    "success",
                    Some("Successfully pulled from remote"),
                    None,
                ).await?;
                Ok(())
            },
            Err(e) => {
                self.git_config_repo.log_sync_operation(
                    user_id,
                    "pull",
                    "error",
                    Some(&e.to_string()),
                    None,
                ).await?;
                Err(Error::BadRequest(format!("Failed to pull: {}", e)))
            }
        }
    }

    pub async fn sync(&self, user_id: Uuid, message: Option<String>, _force: bool) -> Result<GitSyncResponse> {
        // Check if repository is initialized
        let status = self.get_status(user_id).await?;
        if !status.repository_initialized {
            self.init_repository(user_id).await?;
        }

        let mut files_changed = 0;
        let mut commit_hash = None;

        // Commit changes if any
        if status.uncommitted_changes > 0 || status.untracked_files > 0 {
            files_changed = status.uncommitted_changes + status.untracked_files;
            commit_hash = Some(self.add_and_commit(user_id, message).await?);
        } else {
            // Check if there are any commits at all - if not, create initial commit
            let repo_path = self.get_user_repo_path(user_id);
            if let Ok(repo) = Repository::open(&repo_path) {
                if repo.head().is_err() {
                    // No commits yet, create initial commit even if no files
                    commit_hash = Some(self.add_and_commit(user_id, message.or_else(|| Some("Initial commit".to_string()))).await?);
                    files_changed = 0;
                }
            }
        }

        // Push to remote if configured
        let config = self.git_config_repo.get_by_user_id(user_id).await?;
        if let Some(_config) = config {
            // Always try to push if config exists - push_to_remote will handle remote setup
            self.git_config_repo.log_sync_operation(
                user_id,
                "push", 
                "success",
                Some("Starting push to remote"),
                commit_hash.as_deref(),
            ).await?;
            
            self.push_to_remote(user_id).await?;
        } else {
            self.git_config_repo.log_sync_operation(
                user_id,
                "push",
                "error", 
                Some("No Git configuration found"),
                None,
            ).await?;
        }

        Ok(GitSyncResponse {
            success: true,
            message: format!("Sync completed successfully. {} files changed.", files_changed),
            commit_hash,
            files_changed,
        })
    }

    fn setup_auth_callbacks<'a>(&self, callbacks: &mut RemoteCallbacks<'a>, config: &'a GitConfig) -> Result<()> {
        match config.auth_type.as_str() {
            "ssh" => {
                if let Some(ssh_key_path) = config.auth_data.get("private_key_path") {
                    let key_path = ssh_key_path.as_str()
                        .ok_or_else(|| Error::BadRequest("Invalid SSH key path".to_string()))?;
                    
                    let key_path_owned = key_path.to_owned();
                    callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                        Cred::ssh_key(
                            username_from_url.unwrap_or("git"),
                            None,
                            Path::new(&key_path_owned),
                            None,
                        )
                    });
                }
            },
            "token" => {
                if let Some(token) = config.auth_data.get("token") {
                    let token_str = token.as_str()
                        .ok_or_else(|| Error::BadRequest("Invalid token".to_string()))?;
                    
                    let token_owned = token_str.to_owned();
                    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
                        Cred::userpass_plaintext("git", &token_owned)
                    });
                }
            },
            _ => {
                return Err(Error::BadRequest("Unsupported auth type".to_string()));
            }
        }
        Ok(())
    }
}