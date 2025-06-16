
use serde_json::Value;

use crate::utils::jwt::{verify_token, Claims};

/// Extract and verify authentication token from Socket.IO handshake auth data
pub fn verify_socket_auth(auth_data: &Value, jwt_secret: &str) -> Result<Claims, String> {
    // Extract token from auth data
    let token = auth_data
        .as_object()
        .and_then(|obj| obj.get("token"))
        .and_then(|token| token.as_str())
        .ok_or_else(|| "No authentication token provided".to_string())?;
    
    // Verify token
    verify_token(token, jwt_secret)
        .map_err(|e| format!("Invalid authentication token: {}", e))
}

/// Check if the auth data contains a share token
pub fn is_share_token(auth_data: &Value) -> bool {
    auth_data
        .as_object()
        .and_then(|obj| obj.get("token"))
        .and_then(|token| token.as_str())
        .map(|token| token.starts_with("share_"))
        .unwrap_or(false)
}