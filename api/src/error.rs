use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::multipart::MultipartError;
use serde_json::json;
use std::fmt;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug)]
pub enum Error {
    NotFound(String),
    Unauthorized,
    Forbidden,
    BadRequest(String),
    InternalServerError(String),
    Conflict(String),
    
    // Specific errors
    Database(sqlx::Error),
    Jwt(jsonwebtoken::errors::Error),
    Io(std::io::Error),
    Serde(serde_json::Error),
    Anyhow(anyhow::Error),
    Yjs(yrs::error::Error),
    YjsEncoding(yrs::encoding::read::Error),
    SocketIo(socketioxide::BroadcastError),
    SocketIoSend(socketioxide::SendError),
    Base64(base64::DecodeError),
    Multipart(MultipartError),
    Zip(zip::result::ZipError),
    Git(git2::Error),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::NotFound(msg) => write!(f, "Not found: {}", msg),
            Error::Unauthorized => write!(f, "Unauthorized"),
            Error::Forbidden => write!(f, "Forbidden"),
            Error::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            Error::InternalServerError(msg) => write!(f, "Internal server error: {}", msg),
            Error::Conflict(msg) => write!(f, "Conflict: {}", msg),
            Error::Database(e) => write!(f, "Database error: {}", e),
            Error::Jwt(e) => write!(f, "JWT error: {}", e),
            Error::Io(e) => write!(f, "IO error: {}", e),
            Error::Serde(e) => write!(f, "Serialization error: {}", e),
            Error::Anyhow(e) => write!(f, "Error: {}", e),
            Error::Yjs(e) => write!(f, "CRDT error: {}", e),
            Error::YjsEncoding(e) => write!(f, "CRDT encoding error: {}", e),
            Error::SocketIo(e) => write!(f, "Socket.IO error: {}", e),
            Error::SocketIoSend(e) => write!(f, "Socket.IO send error: {}", e),
            Error::Base64(e) => write!(f, "Base64 decode error: {}", e),
            Error::Multipart(e) => write!(f, "Multipart error: {}", e),
            Error::Zip(e) => write!(f, "ZIP error: {}", e),
            Error::Git(e) => write!(f, "Git error: {}", e),
        }
    }
}

impl std::error::Error for Error {}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            Error::NotFound(ref msg) => (StatusCode::NOT_FOUND, msg.as_str()),
            Error::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized"),
            Error::Forbidden => (StatusCode::FORBIDDEN, "Forbidden"),
            Error::BadRequest(ref msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
            Error::InternalServerError(ref msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.as_str()),
            Error::Conflict(ref msg) => (StatusCode::CONFLICT, msg.as_str()),
            Error::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            Error::Jwt(_) => (StatusCode::UNAUTHORIZED, "Authentication error"),
            Error::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "IO error"),
            Error::Serde(_) => (StatusCode::BAD_REQUEST, "Invalid data format"),
            Error::Anyhow(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            Error::Yjs(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Document sync error"),
            Error::YjsEncoding(_) => (StatusCode::BAD_REQUEST, "Invalid document encoding"),
            Error::SocketIo(_) => (StatusCode::INTERNAL_SERVER_ERROR, "WebSocket error"),
            Error::SocketIoSend(_) => (StatusCode::INTERNAL_SERVER_ERROR, "WebSocket send error"),
            Error::Base64(_) => (StatusCode::BAD_REQUEST, "Invalid data encoding"),
            Error::Multipart(_) => (StatusCode::BAD_REQUEST, "Invalid multipart data"),
            Error::Zip(_) => (StatusCode::INTERNAL_SERVER_ERROR, "ZIP creation error"),
            Error::Git(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Git operation error"),
        };

        let body = Json(json!({
            "error": error_message,
            "message": self.to_string(),
        }));

        (status, body).into_response()
    }
}

impl From<sqlx::Error> for Error {
    fn from(err: sqlx::Error) -> Self {
        Error::Database(err)
    }
}

impl From<jsonwebtoken::errors::Error> for Error {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        Error::Jwt(err)
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Io(err)
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Error::Serde(err)
    }
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Error::Anyhow(err)
    }
}

impl From<yrs::error::Error> for Error {
    fn from(err: yrs::error::Error) -> Self {
        Error::Yjs(err)
    }
}

impl From<socketioxide::BroadcastError> for Error {
    fn from(err: socketioxide::BroadcastError) -> Self {
        Error::SocketIo(err)
    }
}

impl From<base64::DecodeError> for Error {
    fn from(err: base64::DecodeError) -> Self {
        Error::Base64(err)
    }
}

impl From<socketioxide::SendError> for Error {
    fn from(err: socketioxide::SendError) -> Self {
        Error::SocketIoSend(err)
    }
}

impl From<yrs::encoding::read::Error> for Error {
    fn from(err: yrs::encoding::read::Error) -> Self {
        Error::YjsEncoding(err)
    }
}

impl From<yrs::error::UpdateError> for Error {
    fn from(err: yrs::error::UpdateError) -> Self {
        Error::InternalServerError(format!("CRDT update error: {:?}", err))
    }
}

impl From<MultipartError> for Error {
    fn from(err: MultipartError) -> Self {
        Error::Multipart(err)
    }
}

impl From<zip::result::ZipError> for Error {
    fn from(err: zip::result::ZipError) -> Self {
        Error::Zip(err)
    }
}

impl From<git2::Error> for Error {
    fn from(err: git2::Error) -> Self {
        Error::Git(err)
    }
}