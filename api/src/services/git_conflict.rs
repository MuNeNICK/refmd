use std::path::{Path, PathBuf};
use git2::{Repository, Status, StatusEntry, MergeOptions, Signature};
use uuid::Uuid;
use serde::{Serialize, Deserialize};

use crate::{
    error::{Error, Result},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictInfo {
    pub has_conflicts: bool,
    pub conflicted_files: Vec<ConflictedFile>,
    pub can_auto_merge: bool,
    pub merge_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictedFile {
    pub file_path: String,
    pub conflict_type: ConflictType,
    pub our_version: Option<String>,
    pub their_version: Option<String>,
    pub base_version: Option<String>,
    pub markers: Vec<ConflictMarker>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictType {
    BothModified,
    BothAdded,
    DeletedByUs,
    DeletedByThem,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictMarker {
    pub start_line: usize,
    pub middle_line: usize,
    pub end_line: usize,
    pub our_content: Vec<String>,
    pub their_content: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MergeResolution {
    pub file_path: String,
    pub resolution_type: ResolutionType,
    pub resolved_content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionType {
    UseOurs,
    UseTheirs,
    Manual,
    Delete,
}

pub struct GitConflictService {
    upload_dir: PathBuf,
}

impl GitConflictService {
    pub fn new(upload_dir: PathBuf) -> Self {
        Self { upload_dir }
    }

    fn get_user_repo_path(&self, user_id: Uuid) -> PathBuf {
        self.upload_dir.join(user_id.to_string())
    }

    pub async fn detect_conflicts(&self, user_id: Uuid) -> Result<ConflictInfo> {
        let repo_path = self.get_user_repo_path(user_id);
        
        // Collect conflict information synchronously
        let conflict_data = {
            let repo = Repository::open(&repo_path)?;
            let statuses = repo.statuses(None)?;
            
            let mut files_to_analyze = Vec::new();
            
            for entry in statuses.iter() {
                if self.is_conflicted(&entry) {
                    let file_path = entry.path()
                        .ok_or_else(|| Error::BadRequest("Invalid file path".to_string()))?
                        .to_string();
                    
                    let conflict_type = self.get_conflict_type(&entry);
                    files_to_analyze.push((file_path, conflict_type));
                }
            }
            
            files_to_analyze
        };
        
        // Now analyze conflicts asynchronously
        let mut conflicted_files = Vec::new();
        for (file_path, conflict_type) in conflict_data {
            let conflicted_file = self.analyze_conflict_file(&repo_path, &file_path, conflict_type).await?;
            conflicted_files.push(conflicted_file);
        }
        
        let has_conflicts = !conflicted_files.is_empty();
        let can_auto_merge = conflicted_files.iter().all(|f| f.conflict_type == ConflictType::BothModified);
        
        Ok(ConflictInfo {
            has_conflicts,
            conflicted_files,
            can_auto_merge,
            merge_message: if has_conflicts {
                Some("Conflicts detected during merge".to_string())
            } else {
                None
            },
        })
    }

    fn is_conflicted(&self, entry: &StatusEntry) -> bool {
        let status = entry.status();
        status.contains(Status::CONFLICTED)
    }

    fn get_conflict_type(&self, entry: &StatusEntry) -> ConflictType {
        let status = entry.status();
        
        if status.contains(Status::INDEX_MODIFIED) && status.contains(Status::WT_MODIFIED) {
            ConflictType::BothModified
        } else if status.contains(Status::INDEX_NEW) && status.contains(Status::WT_NEW) {
            ConflictType::BothAdded
        } else if status.contains(Status::INDEX_DELETED) {
            ConflictType::DeletedByUs
        } else if status.contains(Status::WT_DELETED) {
            ConflictType::DeletedByThem
        } else {
            ConflictType::Unknown
        }
    }

    async fn analyze_conflict_file(&self, repo_path: &PathBuf, file_path: &str, conflict_type: ConflictType) -> Result<ConflictedFile> {
        // Get versions from git in a synchronous block
        let (our_version, their_version, base_version) = {
            let repo = Repository::open(repo_path)?;
            self.get_conflict_versions(&repo, file_path)?
        };
        
        // Read file content asynchronously
        let full_path = repo_path.join(file_path);
        let content = if full_path.exists() {
            tokio::fs::read_to_string(&full_path).await.ok()
        } else {
            None
        };
        
        let markers = if let Some(content) = &content {
            self.parse_conflict_markers(content)
        } else {
            Vec::new()
        };
        
        Ok(ConflictedFile {
            file_path: file_path.to_string(),
            conflict_type,
            our_version,
            their_version,
            base_version,
            markers,
        })
    }
    
    async fn analyze_conflict(&self, repo: &Repository, file_path: &str, conflict_type: ConflictType) -> Result<ConflictedFile> {
        let repo_path = repo.path().parent()
            .ok_or_else(|| Error::BadRequest("Invalid repository path".to_string()))?;
        let full_path = repo_path.join(file_path);
        
        // Read the conflicted file content
        let content = if full_path.exists() {
            tokio::fs::read_to_string(&full_path).await.ok()
        } else {
            None
        };
        
        let markers = if let Some(content) = &content {
            self.parse_conflict_markers(content)
        } else {
            Vec::new()
        };
        
        // Get versions from index
        let (our_version, their_version, base_version) = self.get_conflict_versions(repo, file_path)?;
        
        Ok(ConflictedFile {
            file_path: file_path.to_string(),
            conflict_type,
            our_version,
            their_version,
            base_version,
            markers,
        })
    }

    fn parse_conflict_markers(&self, content: &str) -> Vec<ConflictMarker> {
        let lines: Vec<&str> = content.lines().collect();
        let mut markers = Vec::new();
        let mut i = 0;
        
        while i < lines.len() {
            if lines[i].starts_with("<<<<<<<") {
                let start_line = i;
                let mut our_content = Vec::new();
                let mut their_content = Vec::new();
                
                i += 1;
                
                // Collect our content
                while i < lines.len() && !lines[i].starts_with("=======") {
                    our_content.push(lines[i].to_string());
                    i += 1;
                }
                
                if i < lines.len() && lines[i].starts_with("=======") {
                    let middle_line = i;
                    i += 1;
                    
                    // Collect their content
                    while i < lines.len() && !lines[i].starts_with(">>>>>>>") {
                        their_content.push(lines[i].to_string());
                        i += 1;
                    }
                    
                    if i < lines.len() && lines[i].starts_with(">>>>>>>") {
                        let end_line = i;
                        
                        markers.push(ConflictMarker {
                            start_line,
                            middle_line,
                            end_line,
                            our_content,
                            their_content,
                        });
                    }
                }
            }
            i += 1;
        }
        
        markers
    }

    fn get_conflict_versions(&self, repo: &Repository, file_path: &str) -> Result<(Option<String>, Option<String>, Option<String>)> {
        let index = repo.index()?;
        
        // Get the three stages from index (base, ours, theirs)
        let mut base_version = None;
        let mut our_version = None;
        let mut their_version = None;
        
        for i in 0..index.len() {
            if let Some(entry) = index.get(i) {
                if entry.path == file_path.as_bytes() {
                    // Extract stage from flags (bits 12-13)
                    let stage = (entry.flags >> 12) & 0x3;
                    match stage {
                        1 => { // Base version
                            if let Ok(blob) = repo.find_blob(entry.id) {
                                base_version = String::from_utf8(blob.content().to_vec()).ok();
                            }
                        },
                        2 => { // Our version
                            if let Ok(blob) = repo.find_blob(entry.id) {
                                our_version = String::from_utf8(blob.content().to_vec()).ok();
                            }
                        },
                        3 => { // Their version
                            if let Ok(blob) = repo.find_blob(entry.id) {
                                their_version = String::from_utf8(blob.content().to_vec()).ok();
                            }
                        },
                        _ => {}
                    }
                }
            }
        }
        
        Ok((our_version, their_version, base_version))
    }

    pub async fn resolve_conflict(&self, user_id: Uuid, resolution: MergeResolution) -> Result<()> {
        let repo_path = self.get_user_repo_path(user_id);
        let full_path = repo_path.join(&resolution.file_path);
        
        // Get the content to write in a synchronous block
        let content_to_write = match resolution.resolution_type {
            ResolutionType::UseOurs => {
                // Get our version from stage 2
                let repo = Repository::open(&repo_path)?;
                let index = repo.index()?;
                let mut content = None;
                for i in 0..index.len() {
                    if let Some(entry) = index.get(i) {
                        let stage = (entry.flags >> 12) & 0x3;
                        if entry.path == resolution.file_path.as_bytes() && stage == 2 {
                            let blob = repo.find_blob(entry.id)?;
                            content = Some(blob.content().to_vec());
                            break;
                        }
                    }
                }
                content
            },
            ResolutionType::UseTheirs => {
                // Get their version from stage 3
                let repo = Repository::open(&repo_path)?;
                let index = repo.index()?;
                let mut content = None;
                for i in 0..index.len() {
                    if let Some(entry) = index.get(i) {
                        let stage = (entry.flags >> 12) & 0x3;
                        if entry.path == resolution.file_path.as_bytes() && stage == 3 {
                            let blob = repo.find_blob(entry.id)?;
                            content = Some(blob.content().to_vec());
                            break;
                        }
                    }
                }
                content
            },
            ResolutionType::Manual => {
                // Use the provided resolved content
                resolution.resolved_content.map(|s| s.into_bytes())
            },
            ResolutionType::Delete => {
                None
            }
        };
        
        // Write or delete the file
        match resolution.resolution_type {
            ResolutionType::Delete => {
                if full_path.exists() {
                    tokio::fs::remove_file(&full_path).await?;
                }
            },
            _ => {
                if let Some(content) = content_to_write {
                    tokio::fs::write(&full_path, content).await?;
                } else if resolution.resolution_type == ResolutionType::Manual {
                    return Err(Error::BadRequest("Manual resolution requires resolved content".to_string()));
                }
            }
        }
        
        // Add the resolved file to index in a synchronous block
        {
            let repo = Repository::open(&repo_path)?;
            let mut index = repo.index()?;
            if resolution.resolution_type != ResolutionType::Delete {
                index.add_path(Path::new(&resolution.file_path))?;
            } else {
                index.remove_path(Path::new(&resolution.file_path))?;
            }
            index.write()?;
        }
        
        Ok(())
    }

    pub async fn auto_merge(&self, user_id: Uuid, branch_name: &str) -> Result<bool> {
        let repo_path = self.get_user_repo_path(user_id);
        
        // All git operations in a synchronous block
        {
            let repo = Repository::open(&repo_path)?;
            
            // Get the current branch
            let head = repo.head()?;
            let head_commit = head.peel_to_commit()?;
            
            // Find the branch to merge
            let branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
            let branch_commit = branch.get().peel_to_commit()?;
            
            // Find merge base
            let merge_base = repo.merge_base(head_commit.id(), branch_commit.id())?;
            let _merge_base_commit = repo.find_commit(merge_base)?;
            
            // Perform merge analysis
            let merge_options = MergeOptions::new();
            let annotated_commit = repo.find_annotated_commit(branch_commit.id())?;
            let (merge_analysis, _) = repo.merge_analysis(&[&annotated_commit])?;
            
            if merge_analysis.is_fast_forward() {
                // Fast-forward merge
                repo.checkout_tree(branch_commit.as_object(), None)?;
                repo.set_head(&format!("refs/heads/{}", head.shorthand().unwrap_or("main")))?;
                Ok(true)
            } else if merge_analysis.is_normal() {
                // Try to perform automatic merge
                let mut index = repo.merge_commits(&head_commit, &branch_commit, Some(&merge_options))?;
                
                if index.has_conflicts() {
                    Ok(false) // Cannot auto-merge
                } else {
                    // Write merged tree
                    let tree_id = index.write_tree_to(&repo)?;
                    let tree = repo.find_tree(tree_id)?;
                    
                    // Create merge commit
                    let signature = Signature::now("RefMD System", "system@refmd.local")?;
                    let message = format!("Merge branch '{}'", branch_name);
                    
                    repo.commit(
                        Some("HEAD"),
                        &signature,
                        &signature,
                        &message,
                        &tree,
                        &[&head_commit, &branch_commit],
                    )?;
                    
                    Ok(true)
                }
            } else {
                Ok(false) // Up to date or unborn
            }
        }
    }

    pub async fn abort_merge(&self, user_id: Uuid) -> Result<()> {
        let repo_path = self.get_user_repo_path(user_id);
        
        // All git operations in a synchronous block
        {
            let repo = Repository::open(&repo_path)?;
            
            // Reset to HEAD
            let head = repo.head()?;
            let head_commit = head.peel_to_commit()?;
            
            repo.reset(
                head_commit.as_object(),
                git2::ResetType::Hard,
                None,
            )?;
            
            // Clean up merge state
            repo.cleanup_state()?;
        }
        
        Ok(())
    }
}