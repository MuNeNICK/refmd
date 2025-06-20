use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
use tokio::time::interval;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::services::git_sync::GitSyncService;

#[derive(Clone)]
struct PendingSync {
    user_id: Uuid,
    last_change: DateTime<Utc>,
    document_titles: Vec<String>,
    retry_count: u32,
    last_error: Option<String>,
}

pub struct GitBatchSyncService {
    git_sync_service: Arc<GitSyncService>,
    pending_syncs: Arc<RwLock<HashMap<Uuid, PendingSync>>>,
    sync_interval: Duration,
    is_running: Arc<Mutex<bool>>,
}

impl GitBatchSyncService {
    pub fn new(git_sync_service: Arc<GitSyncService>, sync_interval_secs: u64) -> Self {
        Self {
            git_sync_service,
            pending_syncs: Arc::new(RwLock::new(HashMap::new())),
            sync_interval: Duration::from_secs(sync_interval_secs),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn queue_sync(&self, user_id: Uuid, document_title: String) {
        let mut pending = self.pending_syncs.write().await;
        
        match pending.get_mut(&user_id) {
            Some(sync) => {
                sync.last_change = Utc::now();
                if !sync.document_titles.contains(&document_title) {
                    sync.document_titles.push(document_title);
                }
            }
            None => {
                pending.insert(user_id, PendingSync {
                    user_id,
                    last_change: Utc::now(),
                    document_titles: vec![document_title],
                    retry_count: 0,
                    last_error: None,
                });
            }
        }
    }

    pub async fn start(&self) {
        let mut is_running = self.is_running.lock().await;
        if *is_running {
            tracing::warn!("GitBatchSyncService is already running");
            return;
        }
        *is_running = true;
        drop(is_running);

        let service = self.clone();
        tokio::spawn(async move {
            service.run_batch_sync_loop().await;
        });
    }

    pub async fn stop(&self) {
        let mut is_running = self.is_running.lock().await;
        *is_running = false;
    }

    async fn run_batch_sync_loop(&self) {
        let mut ticker = interval(self.sync_interval);
        
        loop {
            ticker.tick().await;
            
            let is_running = self.is_running.lock().await;
            if !*is_running {
                tracing::info!("GitBatchSyncService stopping");
                break;
            }
            drop(is_running);

            self.process_pending_syncs().await;
        }
    }

    async fn process_pending_syncs(&self) {
        let now = Utc::now();
        let mut pending = self.pending_syncs.write().await;
        
        // Find users ready for sync (no changes in the last 30 seconds or retry needed)
        let mut ready_for_sync = Vec::new();
        for (user_id, sync) in pending.iter() {
            let time_since_last_change = now.signed_duration_since(sync.last_change);
            let should_retry = sync.last_error.is_some() && 
                time_since_last_change > chrono::Duration::seconds(60 * (sync.retry_count + 1) as i64);
            
            if time_since_last_change > chrono::Duration::seconds(30) || should_retry {
                ready_for_sync.push(*user_id);
            }
        }

        // Process each user's sync
        for user_id in ready_for_sync {
            if let Some(mut sync) = pending.remove(&user_id) {
                let git_sync = self.git_sync_service.clone();
                let pending_syncs = self.pending_syncs.clone();
                
                tokio::spawn(async move {
                    let commit_message = if sync.document_titles.len() == 1 {
                        format!("Update document: {}", sync.document_titles[0])
                    } else {
                        format!("Update {} documents: {}", 
                            sync.document_titles.len(),
                            sync.document_titles.join(", ")
                        )
                    };
                    
                    match git_sync.sync(user_id, Some(commit_message), false).await {
                        Ok(_) => {
                            tracing::info!("Batch git sync completed for user {} (retry: {})", user_id, sync.retry_count);
                        }
                        Err(e) => {
                            tracing::error!("Batch git sync failed for user {} (retry: {}): {}", user_id, sync.retry_count, e);
                            
                            // If we haven't reached max retries, requeue
                            if sync.retry_count < 3 {
                                let retry_count = sync.retry_count + 1;
                                sync.retry_count = retry_count;
                                sync.last_error = Some(e.to_string());
                                sync.last_change = Utc::now();
                                
                                let mut pending = pending_syncs.write().await;
                                pending.insert(user_id, sync);
                                
                                tracing::info!("Requeued sync for user {} (retry: {})", user_id, retry_count);
                            } else {
                                tracing::error!("Max retries reached for user {}, giving up", user_id);
                            }
                        }
                    }
                });
            }
        }
    }
}

impl Clone for GitBatchSyncService {
    fn clone(&self) -> Self {
        Self {
            git_sync_service: self.git_sync_service.clone(),
            pending_syncs: self.pending_syncs.clone(),
            sync_interval: self.sync_interval,
            is_running: self.is_running.clone(),
        }
    }
}