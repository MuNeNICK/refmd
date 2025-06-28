use axum::{
    extract::{State, Extension},
    Json,
    Router,
    routing::post,
    middleware::from_fn_with_state,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::{
    error::{Error, Result},
    state::AppState,
    services::auth::AuthService,
    utils::jwt::JwtService,
    middleware::auth::{auth_middleware, AuthUser},
    db::models::User,
};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub name: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub username: String,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id.to_string(),
            email: user.email,
            name: user.name,
            username: user.username,
        }
    }
}

pub fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout).layer(from_fn_with_state(state.clone(), auth_middleware)))
        .with_state(state)
}

async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Check if signup is enabled
    if !state.config.signup_enabled {
        return Err(Error::BadRequest("Sign up is currently disabled".to_string()));
    }
    
    // Validate input
    if req.email.trim().is_empty() || req.name.trim().is_empty() || req.password.len() < 8 {
        return Err(Error::BadRequest("Invalid input".to_string()));
    }
    
    // Validate name format (used as account name in URLs)
    if !req.name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(Error::BadRequest("Name can only contain letters, numbers, hyphens, and underscores".to_string()));
    }
    
    // Create services
    let auth_service = AuthService::new(state.user_repository.clone(), state.jwt_service.clone());
    
    // Register user
    let (tokens, user) = auth_service.register(&req.email, &req.name, &req.password).await?;
    
    Ok(Json(AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: user.into(),
    }))
}

async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Create services
    let auth_service = AuthService::new(state.user_repository.clone(), state.jwt_service.clone());
    
    // Login user
    let (tokens, user) = auth_service.login(&req.email, &req.password).await?;
    
    Ok(Json(AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: user.into(),
    }))
}

async fn refresh(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>> {
    // Create services
    let auth_service = AuthService::new(state.user_repository.clone(), state.jwt_service.clone());
    let jwt_service = JwtService::new(
        state.config.jwt_secret.clone(),
        state.config.jwt_expiry,
        state.config.refresh_token_expiry,
    );
    
    // Refresh token
    let tokens = auth_service.refresh_token(&req.refresh_token).await?;
    
    // Get user from token to return user info
    let claims = jwt_service.verify_token(&tokens.access_token)?;
    let user = state.user_repository.get_by_id(claims.sub).await?;
    
    Ok(Json(AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: user.into(),
    }))
}

async fn logout(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<Option<RefreshRequest>>,
) -> Result<()> {
    // Create services
    let auth_service = AuthService::new(state.user_repository.clone(), state.jwt_service.clone());
    
    // Logout user
    let refresh_token = req.and_then(|r| Some(r.refresh_token));
    auth_service.logout(auth_user.user_id, refresh_token.as_deref()).await?;
    
    Ok(())
}