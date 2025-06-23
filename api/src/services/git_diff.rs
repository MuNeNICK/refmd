use crate::error::{Error, Result};
use git2::{Delta, DiffOptions, Repository};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub file_path: String,
    pub diff_lines: Vec<DiffLine>,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_type: DiffLineType,
    pub old_line_number: Option<u32>,
    pub new_line_number: Option<u32>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
    Added,
    Deleted,
    Context,
}

pub struct GitDiffService {
    repository: Repository,
}

impl GitDiffService {
    pub fn new(repo_path: &Path) -> Result<Self> {
        let repository = Repository::open(repo_path)?;
        Ok(Self { repository })
    }

    pub fn get_file_diff(&self, file_path: &str) -> Result<DiffResult> {
        let head = self.repository.head()
            .map_err(|e| Error::Git(e))?;
        
        let tree = head.peel_to_tree()
            .map_err(|e| Error::Git(e))?;

        let mut diff_options = DiffOptions::new();
        diff_options.pathspec(file_path);
        diff_options.context_lines(3);

        let diff = self.repository.diff_tree_to_workdir(Some(&tree), Some(&mut diff_options))?;

        let mut diff_result = DiffResult {
            file_path: file_path.to_string(),
            diff_lines: Vec::new(),
            old_content: None,
            new_content: None,
        };

        let mut current_old_line = 0;
        let mut current_new_line = 0;

        diff.foreach(
            &mut |_, _| true,
            None,
            None,
            Some(&mut |delta, _, line| {
                if delta.status() == Delta::Untracked {
                    return true;
                }

                let content = String::from_utf8_lossy(line.content()).to_string();
                
                match line.origin() {
                    '+' => {
                        current_new_line += 1;
                        diff_result.diff_lines.push(DiffLine {
                            line_type: DiffLineType::Added,
                            old_line_number: None,
                            new_line_number: Some(current_new_line),
                            content: content.trim_end().to_string(),
                        });
                    }
                    '-' => {
                        current_old_line += 1;
                        diff_result.diff_lines.push(DiffLine {
                            line_type: DiffLineType::Deleted,
                            old_line_number: Some(current_old_line),
                            new_line_number: None,
                            content: content.trim_end().to_string(),
                        });
                    }
                    ' ' => {
                        current_old_line += 1;
                        current_new_line += 1;
                        diff_result.diff_lines.push(DiffLine {
                            line_type: DiffLineType::Context,
                            old_line_number: Some(current_old_line),
                            new_line_number: Some(current_new_line),
                            content: content.trim_end().to_string(),
                        });
                    }
                    _ => {}
                }
                true
            }),
        )
        .map_err(|e| Error::Git(e))?;

        Ok(diff_result)
    }

    pub fn get_commit_diff(&self, from: &str, to: &str) -> Result<Vec<DiffResult>> {
        // Resolve commit references (supports ^, ~, etc.)
        let from_obj = self.repository.revparse_single(from)
            .map_err(|e| Error::BadRequest(format!("Invalid from commit reference '{}': {}", from, e)))?;
        let to_obj = self.repository.revparse_single(to)
            .map_err(|e| Error::BadRequest(format!("Invalid to commit reference '{}': {}", to, e)))?;

        let from_commit = from_obj.peel_to_commit()
            .map_err(|e| Error::BadRequest(format!("'{}' is not a valid commit: {}", from, e)))?;
        let to_commit = to_obj.peel_to_commit()
            .map_err(|e| Error::BadRequest(format!("'{}' is not a valid commit: {}", to, e)))?;

        let from_tree = from_commit.tree()?;
        let to_tree = to_commit.tree()?;

        let mut diff_options = DiffOptions::new();
        diff_options.context_lines(3);

        let diff = self.repository.diff_tree_to_tree(Some(&from_tree), Some(&to_tree), Some(&mut diff_options))?;

        self.process_diff_to_results(diff)
    }

    pub fn get_staged_diff(&self) -> Result<Vec<DiffResult>> {
        let mut diff_options = DiffOptions::new();
        diff_options.context_lines(3);

        // Check if HEAD exists
        match self.repository.head() {
            Ok(head) => {
                let tree = head.peel_to_tree()
                    .map_err(|e| Error::Git(e))?;
                let diff = self.repository.diff_tree_to_index(Some(&tree), None, Some(&mut diff_options))?;
                self.process_diff_to_results(diff)
            }
            Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
                // No commits yet, compare against empty tree
                let diff = self.repository.diff_tree_to_index(None, None, Some(&mut diff_options))?;
                self.process_diff_to_results(diff)
            }
            Err(e) => Err(Error::Git(e))
        }
    }

    pub fn get_working_diff(&self) -> Result<Vec<DiffResult>> {
        let mut diff_options = DiffOptions::new();
        diff_options.context_lines(3);
        diff_options.include_untracked(false);

        let diff = self.repository.diff_index_to_workdir(None, Some(&mut diff_options))?;
        self.process_diff_to_results(diff)
    }

    fn process_diff_to_results(&self, diff: git2::Diff<'_>) -> Result<Vec<DiffResult>> {
        use std::cell::RefCell;
        use std::rc::Rc;

        let results = Rc::new(RefCell::new(Vec::new()));
        let current_file_path = Rc::new(RefCell::new(String::new()));
        let current_diff_result: Rc<RefCell<Option<DiffResult>>> = Rc::new(RefCell::new(None));
        let current_old_line = Rc::new(RefCell::new(0u32));
        let current_new_line = Rc::new(RefCell::new(0u32));

        let results_clone = results.clone();
        let current_file_path_clone = current_file_path.clone();
        let current_diff_result_clone = current_diff_result.clone();
        let current_old_line_clone = current_old_line.clone();
        let current_new_line_clone = current_new_line.clone();

        diff.foreach(
            &mut |delta, _| {
                let file_path = delta.new_file().path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let mut current_fp = current_file_path_clone.borrow_mut();
                if file_path != *current_fp {
                    if let Some(result) = current_diff_result_clone.borrow_mut().take() {
                        results_clone.borrow_mut().push(result);
                    }
                    *current_fp = file_path.clone();
                    *current_diff_result_clone.borrow_mut() = Some(DiffResult {
                        file_path,
                        diff_lines: Vec::new(),
                        old_content: None,
                        new_content: None,
                    });
                    *current_old_line_clone.borrow_mut() = 0;
                    *current_new_line_clone.borrow_mut() = 0;
                }
                true
            },
            None,
            Some(&mut |_, hunk| {
                *current_old_line.borrow_mut() = hunk.old_start() - 1;
                *current_new_line.borrow_mut() = hunk.new_start() - 1;
                true
            }),
            Some(&mut |_, _, line| {
                let content = String::from_utf8_lossy(line.content()).to_string();
                
                if let Some(ref mut diff_result) = *current_diff_result.borrow_mut() {
                    match line.origin() {
                        '+' => {
                            *current_new_line.borrow_mut() += 1;
                            diff_result.diff_lines.push(DiffLine {
                                line_type: DiffLineType::Added,
                                old_line_number: None,
                                new_line_number: Some(*current_new_line.borrow()),
                                content: content.trim_end().to_string(),
                            });
                        }
                        '-' => {
                            *current_old_line.borrow_mut() += 1;
                            diff_result.diff_lines.push(DiffLine {
                                line_type: DiffLineType::Deleted,
                                old_line_number: Some(*current_old_line.borrow()),
                                new_line_number: None,
                                content: content.trim_end().to_string(),
                            });
                        }
                        ' ' => {
                            *current_old_line.borrow_mut() += 1;
                            *current_new_line.borrow_mut() += 1;
                            diff_result.diff_lines.push(DiffLine {
                                line_type: DiffLineType::Context,
                                old_line_number: Some(*current_old_line.borrow()),
                                new_line_number: Some(*current_new_line.borrow()),
                                content: content.trim_end().to_string(),
                            });
                        }
                        _ => {}
                    }
                }
                true
            }),
        )
        .map_err(|e| Error::Git(e))?;

        if let Some(result) = current_diff_result.borrow_mut().take() {
            results.borrow_mut().push(result);
        }

        let final_results = results.borrow().clone();
        Ok(final_results)
    }

    pub fn get_file_commit_diff(&self, from: &str, to: &str, file_path: &str) -> Result<DiffResult> {
        tracing::info!("get_file_commit_diff - from: {}, to: {}, file_path: {}", from, to, file_path);
        
        // Handle the case where 'from' might be invalid (e.g., first commit)
        let (from_tree, to_tree) = if from.ends_with("^") && from.len() > 41 {
            // This is a parent reference that might not exist for the first commit
            let to_oid = self.repository.revparse_single(to)?.id();
            let to_commit = self.repository.find_commit(to_oid)?;
            
            // Check if this commit has a parent
            if to_commit.parent_count() == 0 {
                // First commit - compare against empty tree
                (None, Some(to_commit.tree()?))
            } else {
                // Normal case - get parent tree
                let parent = to_commit.parent(0)?;
                (Some(parent.tree()?), Some(to_commit.tree()?))
            }
        } else {
            // Normal case - both commits exist
            let from_oid = self.repository.revparse_single(from)?.id();
            let to_oid = self.repository.revparse_single(to)?.id();
            
            let from_commit = self.repository.find_commit(from_oid)?;
            let to_commit = self.repository.find_commit(to_oid)?;
            
            (Some(from_commit.tree()?), Some(to_commit.tree()?))
        };
        
        let mut diff_options = DiffOptions::new();
        diff_options.pathspec(file_path);
        diff_options.context_lines(3);
        
        let diff = self.repository.diff_tree_to_tree(
            from_tree.as_ref(),
            to_tree.as_ref(),
            Some(&mut diff_options),
        )?;
        
        tracing::info!("Diff created, delta count: {}", diff.deltas().len());
        
        let mut diff_result = DiffResult {
            file_path: file_path.to_string(),
            diff_lines: Vec::new(),
            old_content: None,
            new_content: None,
        };
        
        let current_old_line = std::cell::RefCell::new(0u32);
        let current_new_line = std::cell::RefCell::new(0u32);
        let current_file_path = std::cell::RefCell::new(String::new());
        
        diff.foreach(
            &mut |delta, _| {
                let path = delta.new_file().path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|| delta.old_file().path()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default());
                *current_file_path.borrow_mut() = path.clone();
                true
            },
            None,
            Some(&mut |_, hunk| {
                *current_old_line.borrow_mut() = hunk.old_start() - 1;
                *current_new_line.borrow_mut() = hunk.new_start() - 1;
                true
            }),
            Some(&mut |_, _, line| {
                let content = String::from_utf8_lossy(line.content()).to_string();
                
                match line.origin() {
                    '+' => {
                        *current_new_line.borrow_mut() += 1;
                        diff_result.diff_lines.push(DiffLine {
                            line_type: DiffLineType::Added,
                            old_line_number: None,
                            new_line_number: Some(*current_new_line.borrow()),
                            content: content.trim_end().to_string(),
                        });
                    }
                    '-' => {
                        *current_old_line.borrow_mut() += 1;
                        diff_result.diff_lines.push(DiffLine {
                            line_type: DiffLineType::Deleted,
                            old_line_number: Some(*current_old_line.borrow()),
                            new_line_number: None,
                            content: content.trim_end().to_string(),
                        });
                    }
                    ' ' => {
                        *current_old_line.borrow_mut() += 1;
                        *current_new_line.borrow_mut() += 1;
                        diff_result.diff_lines.push(DiffLine {
                            line_type: DiffLineType::Context,
                            old_line_number: Some(*current_old_line.borrow()),
                            new_line_number: Some(*current_new_line.borrow()),
                            content: content.trim_end().to_string(),
                        });
                    }
                    _ => {}
                }
                true
            }),
        )?;
        
        if !current_file_path.borrow().is_empty() {
            diff_result.file_path = current_file_path.borrow().clone();
        }
        
        Ok(diff_result)
    }
}