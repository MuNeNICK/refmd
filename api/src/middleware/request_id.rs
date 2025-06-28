use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;
use axum::http::HeaderValue;

/// Middleware to add a unique request ID to each request
pub async fn request_id_middleware(
    mut request: Request,
    next: Next,
) -> Response {
    // Generate a unique request ID
    let request_id = Uuid::new_v4().to_string();
    
    // Add request ID to request extensions for logging
    request.extensions_mut().insert(request_id.clone());
    
    // Process the request
    let mut response = next.run(request).await;
    
    // Add request ID to response headers
    response.headers_mut().insert(
        "x-request-id",
        HeaderValue::from_str(&request_id).unwrap_or_else(|_| HeaderValue::from_static("unknown"))
    );
    
    response
}