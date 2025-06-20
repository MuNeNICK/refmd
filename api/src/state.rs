use std::sync::Arc;
use std::path::PathBuf;
use sqlx::PgPool;
use crate::config::Config;
use crate::crdt::{DocumentManager, AwarenessManager, DocumentPersistence};
use crate::services::{crdt::CrdtService, document::DocumentService, file::FileService, share::ShareService};
use crate::repository::{DocumentRepository, ShareRepository, UserRepository};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db_pool: Arc<PgPool>,
    pub document_manager: Arc<DocumentManager>,
    pub awareness_manager: Arc<AwarenessManager>,
    pub document_persistence: Arc<DocumentPersistence>,
    pub crdt_service: Arc<CrdtService>,
    pub document_service: Arc<DocumentService>,
    pub file_service: Arc<FileService>,
    pub share_service: Arc<ShareService>,
    pub document_repository: Arc<DocumentRepository>,
    pub share_repository: Arc<ShareRepository>,
    pub user_repository: Arc<UserRepository>,
}

impl AppState {
    pub fn new(config: Config, db_pool: PgPool) -> Arc<Self> {
        let db_pool = Arc::new(db_pool);
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
        
        // Create document service
        let document_service = Arc::new(DocumentService::new(
            document_repository.clone(),
            storage_path.clone(),
            crdt_service.clone(),
        ));
        let frontend_url = config.frontend_url.clone().unwrap_or_else(|| "http://localhost:3000".to_string());
        
        let file_service = Arc::new(FileService::new(
            db_pool.clone(),
            storage_path,
            frontend_url.clone(),
        ));
        
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
            document_manager,
            awareness_manager,
            document_persistence,
            crdt_service,
            document_service,
            file_service,
            share_service,
            document_repository,
            share_repository,
            user_repository,
        })
    }
}