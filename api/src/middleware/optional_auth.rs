use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use std::sync::Arc;
use crate::{error::Error, state::AppState, utils::jwt::JwtService};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct OptionalAuthUser {
    pub user_id: Option<Uuid>,
}

pub async fn optional_auth_middleware(
    auth: Option<TypedHeader<Authorization<Bearer>>>,
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, Error> {
    let mut user_id: Option<Uuid> = None;
    
    if let Some(auth_header) = auth {
        let token = auth_header.token();
        
        // Create JWT service
        let jwt_service = JwtService::new(
            state.config.jwt_secret.clone(),
            state.config.jwt_expiry,
            state.config.refresh_token_expiry,
        );
        
        // Try to validate token
        if let Ok(claims) = jwt_service.verify_token(token) {
            // Set user_id if token is valid
            user_id = Some(claims.sub);
        }
        // If token is invalid, we don't error out, just continue without auth
    }
    
    // Insert OptionalAuthUser with the user_id (which may be None)
    request.extensions_mut().insert(OptionalAuthUser { user_id });
    
    let response = next.run(request).await;
    Ok(response)
}