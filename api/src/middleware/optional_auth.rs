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
use super::auth::AuthUser;

pub async fn optional_auth_middleware(
    auth: Option<TypedHeader<Authorization<Bearer>>>,
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, Error> {
    let mut auth_user: Option<AuthUser> = None;
    
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
            // Create auth user
            auth_user = Some(AuthUser {
                user_id: claims.sub,
            });
        }
        // If token is invalid, we don't error out, just continue without auth
    }
    
    // Always insert Option<AuthUser>, even if it's None
    request.extensions_mut().insert(auth_user);
    
    let response = next.run(request).await;
    Ok(response)
}