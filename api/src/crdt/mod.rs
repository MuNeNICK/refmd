pub mod document;
pub mod awareness;
pub mod persistence;

pub use document::{CrdtDocument, DocumentManager};
pub use awareness::{
    AwarenessManager, UserPresence, CursorPosition, SelectionRange
};
pub use persistence::{DocumentPersistence, serialization};