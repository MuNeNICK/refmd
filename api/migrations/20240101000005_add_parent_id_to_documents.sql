-- Add parent_id column to documents table
ALTER TABLE documents 
ADD COLUMN parent_id UUID REFERENCES documents(id) ON DELETE CASCADE;

-- Create index for parent_id to optimize tree queries
CREATE INDEX idx_documents_parent_id ON documents(parent_id);

-- Update the document tree query function to include parent_id
-- (if any exist)