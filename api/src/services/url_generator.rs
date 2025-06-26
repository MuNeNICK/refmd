use uuid::Uuid;

/// Service for generating consistent URLs for documents across the application
pub struct UrlGeneratorService {
    frontend_url: String,
}

impl UrlGeneratorService {
    pub fn new(frontend_url: String) -> Self {
        Self { frontend_url }
    }
    
    /// Generate a share URL for a document with a token
    pub fn generate_share_url(&self, document_id: Uuid, token: &str, document_type: &str) -> String {
        match document_type {
            "scrap" => format!("{}/scrap/{}?token={}", self.frontend_url, document_id, token),
            _ => format!("{}/document/{}?token={}", self.frontend_url, document_id, token),
        }
    }
    
    /// Generate a public URL for a published document
    pub fn generate_public_url(&self, username: &str, document_id: Uuid) -> String {
        format!("{}/u/{}/{}", self.frontend_url, username, document_id)
    }
}