-- Add scrap support to documents table
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents 
ADD CONSTRAINT documents_type_check 
CHECK (type IN ('document', 'folder', 'scrap'));

-- Create scrap_posts table
CREATE TABLE scrap_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_scrap_posts_document_id ON scrap_posts(document_id);
CREATE INDEX idx_scrap_posts_author_id ON scrap_posts(author_id);
CREATE INDEX idx_scrap_posts_created_at ON scrap_posts(created_at);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scrap_posts_updated_at BEFORE UPDATE
    ON scrap_posts FOR EACH ROW EXECUTE PROCEDURE 
    update_updated_at_column();