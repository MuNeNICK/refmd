use std::sync::Arc;
use std::path::PathBuf;
use sqlx::PgPool;
use crate::config::Config;
use crate::crdt::{DocumentManager, AwarenessManager, DocumentPersistence};
use crate::services::{crdt::CrdtService, document::DocumentService, file::FileService, share::ShareService, git_sync::GitSyncService, git_batch_sync::GitBatchSyncService, document_links::DocumentLinksService, PublicDocumentService, UrlGeneratorService};
use crate::repository::{DocumentRepository, ShareRepository, UserRepository, GitConfigRepository};
use crate::utils::jwt::JwtService;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db_pool: Arc<PgPool>,
    pub jwt_service: Arc<JwtService>,
    pub document_manager: Arc<DocumentManager>,
    pub awareness_manager: Arc<AwarenessManager>,
    pub document_persistence: Arc<DocumentPersistence>,
    pub crdt_service: Arc<CrdtService>,
    pub document_service: Arc<DocumentService>,
    pub file_service: Arc<FileService>,
    pub share_service: Arc<ShareService>,
    pub git_sync_service: Arc<GitSyncService>,
    pub git_batch_sync_service: Option<Arc<GitBatchSyncService>>,
    pub document_links_service: Arc<DocumentLinksService>,
    pub public_document_service: Arc<PublicDocumentService>,
    pub url_generator: Arc<UrlGeneratorService>,
    pub document_repository: Arc<DocumentRepository>,
    pub share_repository: Arc<ShareRepository>,
    pub user_repository: Arc<UserRepository>,
    pub git_config_repository: Arc<GitConfigRepository>,
}

impl AppState {
    pub fn new(config: Config, db_pool: PgPool) -> Arc<Self> {
        let db_pool = Arc::new(db_pool);
        
        // Create JWT service once and reuse
        let jwt_service = Arc::new(JwtService::new(
            config.jwt_secret.clone(),
            config.jwt_expiry,
            config.refresh_token_expiry,
        ));
        
        let document_manager = Arc::new(DocumentManager::new());
        let awareness_manager = Arc::new(AwarenessManager::new());
        let document_persistence = Arc::new(DocumentPersistence::new((*db_pool).clone()));
        
        let crdt_service = Arc::new(CrdtService::new(
            document_manager.clone(),
            awareness_manager.clone(),
            document_persistence.clone(),
        ));
        
        // Create storage directory from config
        let storage_path = PathBuf::from(&config.upload_dir);
        
        // Create document repository first
        let document_repository = Arc::new(DocumentRepository::new(db_pool.clone()));
        
        // Create git config repository
        let git_config_repository = Arc::new(GitConfigRepository::new(db_pool.clone()));
        
        // Create git sync service
        let git_sync_service = Arc::new(GitSyncService::new(
            git_config_repository.clone(),
            storage_path.clone(),
            &config.jwt_secret,
        ).expect("Failed to create GitSyncService"));
        
        // Create batch sync service if auto sync is enabled
        let git_batch_sync_service = if config.git_sync_enabled && config.git_auto_sync {
            Some(Arc::new(GitBatchSyncService::new(
                git_sync_service.clone(),
                config.git_sync_interval,
            )))
        } else {
            None
        };
        
        // Create document links service first
        let document_links_service = Arc::new(DocumentLinksService::new(db_pool.clone()));
        
        // Create public document service
        let public_document_service = Arc::new(PublicDocumentService::new(db_pool.clone()));
        
        let frontend_url = config.frontend_url.clone().unwrap_or_else(|| "http://localhost:3000".to_string());
        
        // Create URL generator service
        let url_generator = Arc::new(UrlGeneratorService::new(frontend_url.clone()));
        
        // Create file service first
        let file_service = Arc::new(FileService::new(
            db_pool.clone(),
            storage_path.clone(),
            frontend_url.clone(),
        ));
        
        // Create document service with batch sync if enabled
        let document_service = Arc::new(DocumentService::new(
            document_repository.clone(),
            storage_path.clone(),
            crdt_service.clone(),
            git_batch_sync_service.clone(),
            Arc::new(config.clone()),
        ).with_links_service(document_links_service.clone())
         .with_file_service(file_service.clone()));
        
        // Create share service with frontend URL from config
        let share_service = Arc::new(ShareService::new(
            db_pool.clone(),
            frontend_url,
        ));
        
        // Create other repositories
        let share_repository = Arc::new(ShareRepository::new(db_pool.clone()));
        let user_repository = Arc::new(UserRepository::new(db_pool.clone()));
        
        Arc::new(Self {
            config,
            db_pool,
            jwt_service,
            document_manager,
            awareness_manager,
            document_persistence,
            crdt_service,
            document_service,
            file_service,
            share_service,
            git_sync_service,
            git_batch_sync_service,
            document_links_service,
            public_document_service,
            url_generator,
            document_repository,
            share_repository,
            user_repository,
            git_config_repository,
        })
    }
}