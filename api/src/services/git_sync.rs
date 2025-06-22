use std::path::PathBuf;
use std::sync::Arc;
use std::collections::HashMap;
use git2::{Repository, Signature, RemoteCallbacks, Cred, PushOptions, FetchOptions, MergeOptions};
use uuid::Uuid;
use chrono::{Utc, DateTime};
use tokio::sync::RwLock;

use crate::{
    entities::git_config::{GitConfig, GitStatus, GitSyncResponse},
    repository::GitConfigRepository,
    utils::encryption::EncryptionService,
    services::git_conflict::{GitConflictService, ConflictInfo},
    error::{Error, Result},
};

pub struct GitSyncService {
    git_config_repo: Arc<GitConfigRepository>,
    upload_dir: PathBuf,
    encryption_service: EncryptionService,
    push_in_progress: Arc<RwLock<HashMap<Uuid, DateTime<Utc>>>>,
}

impl GitSyncService {
    pub fn new(git_config_repo: Arc<GitConfigRepository>, upload_dir: PathBuf, jwt_secret: &str) -> Result<Self> {
        let encryption_service = EncryptionService::new(jwt_secret)?;
        Ok(Self {
            git_config_repo,
            upload_dir,
            encryption_service,
            push_in_progress: Arc::new(RwLock::new(HashMap::new())),
        })
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
                
                // Create default .gitignore
                self.create_default_gitignore(user_id).await?;
                
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
        // Check if a push is already in progress for this user
        {
            let push_map = self.push_in_progress.read().await;
            if let Some(last_push) = push_map.get(&user_id) {
                let time_since_push = Utc::now().signed_duration_since(*last_push);
                if time_since_push < chrono::Duration::seconds(10) {
                    tracing::info!("Push already in progress for user {}, skipping", user_id);
                    return Ok(());
                }
            }
        }
        
        // Mark push as in progress
        {
            let mut push_map = self.push_in_progress.write().await;
            push_map.insert(user_id, Utc::now());
        }
        
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

        // Clean up push tracking after operation
        let result = match push_result {
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
        };
        
        // Remove from push tracking
        {
            let mut push_map = self.push_in_progress.write().await;
            push_map.remove(&user_id);
        }
        
        result
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
                // After successful fetch, try to merge
                let merge_result = self.merge_fetched_branch(user_id, &config.branch_name).await;
                
                match merge_result {
                    Ok(conflict_info) => {
                        if conflict_info.has_conflicts {
                            self.git_config_repo.log_sync_operation(
                                user_id,
                                "pull",
                                "conflict",
                                Some("Pull completed with conflicts"),
                                None,
                            ).await?;
                            return Err(Error::BadRequest("Pull completed but conflicts detected".to_string()));
                        } else {
                            self.git_config_repo.log_sync_operation(
                                user_id,
                                "pull",
                                "success",
                                Some("Successfully pulled and merged from remote"),
                                None,
                            ).await?;
                            Ok(())
                        }
                    },
                    Err(e) => {
                        self.git_config_repo.log_sync_operation(
                            user_id,
                            "pull",
                            "error",
                            Some(&format!("Merge failed: {}", e)),
                            None,
                        ).await?;
                        Err(e)
                    }
                }
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

    async fn merge_fetched_branch(&self, user_id: Uuid, branch_name: &str) -> Result<ConflictInfo> {
        let repo_path = self.get_user_repo_path(user_id);
        
        // Perform git operations in a synchronous block
        let merge_result = {
            let repo = Repository::open(&repo_path)?;
            
            // Get the fetched branch reference
            let fetch_head = format!("refs/remotes/origin/{}", branch_name);
            let annotated_commit = repo.find_annotated_commit(
                repo.refname_to_id(&fetch_head)?
            )?;
            
            // Perform merge analysis
            let (merge_analysis, _) = repo.merge_analysis(&[&annotated_commit])?;
            
            if merge_analysis.is_up_to_date() {
                // Nothing to merge
                return Ok(ConflictInfo {
                    has_conflicts: false,
                    conflicted_files: vec![],
                    can_auto_merge: true,
                    merge_message: Some("Already up to date".to_string()),
                });
            }
            
            if merge_analysis.is_fast_forward() {
                // Fast-forward merge
                let refname = format!("refs/heads/{}", branch_name);
                let mut reference = repo.find_reference(&refname)?;
                reference.set_target(annotated_commit.id(), "Fast-forward merge")?;
                repo.set_head(&refname)?;
                repo.checkout_head(None)?;
                
                return Ok(ConflictInfo {
                    has_conflicts: false,
                    conflicted_files: vec![],
                    can_auto_merge: true,
                    merge_message: Some("Fast-forward merge completed".to_string()),
                });
            }
            
            // Normal merge required
            let mut merge_options = MergeOptions::new();
            repo.merge(&[&annotated_commit], Some(&mut merge_options), None)?;
            
            // Return whether we need to check for conflicts
            true
        };
        
        // If merge was performed, check for conflicts
        if merge_result {
            let conflict_service = GitConflictService::new(self.upload_dir.clone());
            let conflict_info = conflict_service.detect_conflicts(user_id).await?;
            
            if !conflict_info.has_conflicts {
                // No conflicts, create merge commit in a synchronous block
                {
                    let repo = Repository::open(&repo_path)?;
                    let fetch_head = format!("refs/remotes/origin/{}", branch_name);
                    let annotated_commit = repo.find_annotated_commit(
                        repo.refname_to_id(&fetch_head)?
                    )?;
                    
                    let signature = Signature::now("RefMD System", "system@refmd.local")?;
                    let head = repo.head()?.peel_to_commit()?;
                    let fetched = repo.find_commit(annotated_commit.id())?;
                    
                    let mut index = repo.index()?;
                    let tree_id = index.write_tree()?;
                    let tree = repo.find_tree(tree_id)?;
                    
                    repo.commit(
                        Some("HEAD"),
                        &signature,
                        &signature,
                        &format!("Merge branch '{}' from remote", branch_name),
                        &tree,
                        &[&head, &fetched],
                    )?;
                    
                    // Clean up merge state
                    repo.cleanup_state()?;
                }
            }
            
            Ok(conflict_info)
        } else {
            // This shouldn't happen, but just in case
            Ok(ConflictInfo {
                has_conflicts: false,
                conflicted_files: vec![],
                can_auto_merge: true,
                merge_message: Some("Merge completed".to_string()),
            })
        }
    }

    pub async fn get_conflicts(&self, user_id: Uuid) -> Result<ConflictInfo> {
        let conflict_service = GitConflictService::new(self.upload_dir.clone());
        conflict_service.detect_conflicts(user_id).await
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
        // Decrypt auth data first
        let decrypted_auth_data = config.decrypt_auth_data(&self.encryption_service)?;
        
        match config.auth_type.as_str() {
            "ssh" => {
                if let Some(private_key_json) = decrypted_auth_data.get("private_key") {
                    let private_key = private_key_json.as_str()
                        .ok_or_else(|| Error::BadRequest("Invalid SSH private key".to_string()))?;
                    
                    let private_key_owned = private_key.to_owned();
                    callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                        Cred::ssh_key_from_memory(
                            username_from_url.unwrap_or("git"),
                            None,
                            &private_key_owned,
                            None,
                        )
                    });
                }
            },
            "token" => {
                if let Some(token) = decrypted_auth_data.get("token") {
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

    pub async fn create_default_gitignore(&self, user_id: Uuid) -> Result<()> {
        let repo_path = self.get_user_repo_path(user_id);
        let gitignore_path = repo_path.join(".gitignore");
        
        // Check if .gitignore already exists
        if gitignore_path.exists() {
            return Ok(());
        }
        
        // Default .gitignore content for RefMD
        let gitignore_content = r#"# RefMD Git Sync ignore patterns

# System files
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# Temporary files
*.tmp
*.temp
.~lock.*

# Editor directories
.vscode/
.idea/
*.sublime-*

# Log files
*.log

# Node modules (if any frontend assets are stored)
node_modules/

# Python cache (if any scripts are used)
__pycache__/
*.pyc

# Custom ignore patterns
# Add document-specific patterns below
"#;

        tokio::fs::write(&gitignore_path, gitignore_content).await?;
        
        // Commit the .gitignore file
        self.add_and_commit(user_id, Some("Add default .gitignore".to_string())).await?;
        
        Ok(())
    }

    pub async fn add_to_gitignore(&self, user_id: Uuid, patterns: Vec<String>) -> Result<()> {
        let repo_path = self.get_user_repo_path(user_id);
        let gitignore_path = repo_path.join(".gitignore");
        
        // Read existing content or create new
        let mut content = if gitignore_path.exists() {
            tokio::fs::read_to_string(&gitignore_path).await?
        } else {
            String::new()
        };
        
        // Add new patterns
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        
        for pattern in patterns {
            content.push_str(&format!("{}\n", pattern));
        }
        
        tokio::fs::write(&gitignore_path, content).await?;
        
        // Commit the changes
        self.add_and_commit(user_id, Some("Update .gitignore".to_string())).await?;
        
        Ok(())
    }

    pub async fn is_path_ignored(&self, user_id: Uuid, path: &str) -> Result<bool> {
        let repo_path = self.get_user_repo_path(user_id);
        
        let is_ignored = {
            let repo = Repository::open(&repo_path)?;
            repo.is_path_ignored(std::path::Path::new(path))?
        };
        
        Ok(is_ignored)
    }

    pub async fn get_gitignore_patterns(&self, user_id: Uuid) -> Result<Vec<String>> {
        let repo_path = self.get_user_repo_path(user_id);
        let gitignore_path = repo_path.join(".gitignore");
        
        if !gitignore_path.exists() {
            return Ok(Vec::new());
        }
        
        let content = tokio::fs::read_to_string(&gitignore_path).await?;
        let patterns: Vec<String> = content
            .lines()
            .filter(|line| !line.trim().is_empty() && !line.trim().starts_with('#'))
            .map(|line| line.to_string())
            .collect();
        
        Ok(patterns)
    }

    pub async fn get_commit_history(&self, user_id: Uuid, limit: Option<usize>) -> Result<Vec<GitCommit>> {
        let repo_path = self.get_user_repo_path(user_id);
        
        let repo = Repository::open(&repo_path)?;
        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;
        
        let limit = limit.unwrap_or(50);
        let mut commits = Vec::new();
        
        for (i, oid) in revwalk.enumerate() {
            if i >= limit {
                break;
            }
            
            let oid = oid?;
            let commit = repo.find_commit(oid)?;
            
            let author = commit.author();
            let author_name = author.name().unwrap_or("Unknown").to_string();
            let author_email = author.email().unwrap_or("unknown@example.com").to_string();
            
            let timestamp = commit.time().seconds();
            let datetime = DateTime::<Utc>::from_timestamp(timestamp, 0)
                .unwrap_or_else(|| Utc::now());
            
            let parent_count = commit.parent_count();
            let mut diff_stats = DiffStats::default();
            
            // Get diff stats for non-merge commits
            if parent_count <= 1 {
                if let Some(parent) = commit.parents().next() {
                    let parent_tree = parent.tree()?;
                    let commit_tree = commit.tree()?;
                    let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&commit_tree), None)?;
                    
                    let stats = diff.stats()?;
                    diff_stats.files_changed = stats.files_changed();
                    diff_stats.insertions = stats.insertions();
                    diff_stats.deletions = stats.deletions();
                } else {
                    // First commit - count all files
                    let tree = commit.tree()?;
                    let diff = repo.diff_tree_to_tree(None, Some(&tree), None)?;
                    
                    let stats = diff.stats()?;
                    diff_stats.files_changed = stats.files_changed();
                    diff_stats.insertions = stats.insertions();
                    diff_stats.deletions = stats.deletions();
                }
            }
            
            commits.push(GitCommit {
                id: oid.to_string(),
                message: commit.message().unwrap_or("No message").to_string(),
                author_name,
                author_email,
                timestamp: datetime,
                diff_stats: Some(diff_stats),
            });
        }
        
        Ok(commits)
    }

    pub async fn get_file_history(&self, user_id: Uuid, file_path: &str, limit: Option<usize>) -> Result<Vec<GitCommit>> {
        let repo_path = self.get_user_repo_path(user_id);
        
        // Remove user_id prefix from file_path if present
        let cleaned_path = if file_path.starts_with(&format!("{}/", user_id)) {
            file_path.strip_prefix(&format!("{}/", user_id)).unwrap()
        } else {
            file_path
        };
        
        tracing::info!("get_file_history - original path: {}, cleaned path: {}", file_path, cleaned_path);
        
        let repo = Repository::open(&repo_path)?;
        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;
        
        let limit = limit.unwrap_or(50);
        let mut commits = Vec::new();
        let mut found = 0;
        
        for oid in revwalk {
            if found >= limit {
                break;
            }
            
            let oid = oid?;
            let commit = repo.find_commit(oid)?;
            
            // Check if this commit modified the file
            let mut file_changed = false;
            
            if commit.parent_count() == 0 {
                // First commit - check if file exists
                let tree = commit.tree()?;
                if tree.get_path(std::path::Path::new(cleaned_path)).is_ok() {
                    file_changed = true;
                }
            } else {
                // Check if file was modified in this commit
                for parent in commit.parents() {
                    let parent_tree = parent.tree()?;
                    let commit_tree = commit.tree()?;
                    
                    let mut diff_options = git2::DiffOptions::new();
                    diff_options.pathspec(cleaned_path);
                    
                    let diff = repo.diff_tree_to_tree(
                        Some(&parent_tree),
                        Some(&commit_tree),
                        Some(&mut diff_options)
                    )?;
                    
                    if diff.deltas().len() > 0 {
                        file_changed = true;
                        break;
                    }
                }
            }
            
            if file_changed {
                let author = commit.author();
                let author_name = author.name().unwrap_or("Unknown").to_string();
                let author_email = author.email().unwrap_or("unknown@example.com").to_string();
                
                let timestamp = commit.time().seconds();
                let datetime = DateTime::<Utc>::from_timestamp(timestamp, 0)
                    .unwrap_or_else(|| Utc::now());
                
                // Get diff stats for this specific file
                let mut diff_stats = DiffStats::default();
                
                if commit.parent_count() <= 1 {
                    if let Some(parent) = commit.parents().next() {
                        let parent_tree = parent.tree()?;
                        let commit_tree = commit.tree()?;
                        
                        let mut diff_options = git2::DiffOptions::new();
                        diff_options.pathspec(cleaned_path);
                        
                        let diff = repo.diff_tree_to_tree(
                            Some(&parent_tree),
                            Some(&commit_tree),
                            Some(&mut diff_options)
                        )?;
                        
                        let stats = diff.stats()?;
                        diff_stats.files_changed = stats.files_changed();
                        diff_stats.insertions = stats.insertions();
                        diff_stats.deletions = stats.deletions();
                    } else {
                        // First commit - count file as new
                        let tree = commit.tree()?;
                        let mut diff_options = git2::DiffOptions::new();
                        diff_options.pathspec(cleaned_path);
                        
                        let diff = repo.diff_tree_to_tree(None, Some(&tree), Some(&mut diff_options))?;
                        
                        let stats = diff.stats()?;
                        diff_stats.files_changed = stats.files_changed();
                        diff_stats.insertions = stats.insertions();
                        diff_stats.deletions = stats.deletions();
                    }
                }
                
                commits.push(GitCommit {
                    id: oid.to_string(),
                    message: commit.message().unwrap_or("No message").to_string(),
                    author_name,
                    author_email,
                    timestamp: datetime,
                    diff_stats: Some(diff_stats),
                });
                
                found += 1;
            }
        }
        
        Ok(commits)
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GitCommit {
    pub id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: DateTime<Utc>,
    pub diff_stats: Option<DiffStats>,
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct DiffStats {
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
}