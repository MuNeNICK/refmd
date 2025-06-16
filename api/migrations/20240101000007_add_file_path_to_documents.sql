-- Add file_path column to documents table
ALTER TABLE documents ADD COLUMN file_path TEXT;

-- Create index for file_path lookups
CREATE INDEX idx_documents_file_path ON documents(file_path);

-- Update existing documents to have NULL file_path (will be populated when documents are next saved)
-- This is intentionally left as NULL to avoid issues with existing data