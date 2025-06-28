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
use uuid::Uuid;
use crate::{error::Error, state::AppState};

#[derive(Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

pub async fn auth_middleware(
    auth: Option<TypedHeader<Authorization<Bearer>>>,
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, Error> {
    let auth_header = auth.ok_or(Error::Unauthorized)?;
    let token = auth_header.token();
    
    // Use shared JWT service from state
    let claims = state.jwt_service.verify_token(token)?;
    
    // Create auth user
    let auth_user = AuthUser {
        user_id: claims.sub,
    };
    
    // Insert auth user into request extensions
    request.extensions_mut().insert(auth_user);
    
    let response = next.run(request).await;
    Ok(response)
}