-- Create document_links table for tracking references between documents
CREATE TABLE document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'reference' CHECK (link_type IN ('reference', 'embed', 'mention')),
    link_text TEXT, -- The text used in the link (e.g., "[[Custom Text|Document Title]]")
    position_start INTEGER, -- Character position in source document where link starts
    position_end INTEGER, -- Character position in source document where link ends
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_document_id, target_document_id, position_start)
);

-- Indexes for efficient querying
CREATE INDEX idx_document_links_source ON document_links(source_document_id);
CREATE INDEX idx_document_links_target ON document_links(target_document_id);
CREATE INDEX idx_document_links_type ON document_links(link_type);
CREATE INDEX idx_document_links_created_at ON document_links(created_at);

-- Function to get all documents that link to a specific document (backlinks)
CREATE OR REPLACE FUNCTION get_document_backlinks(p_document_id UUID)
RETURNS TABLE (
    document_id UUID,
    title TEXT,
    link_type TEXT,
    link_text TEXT,
    link_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as document_id,
        d.title,
        dl.link_type,
        dl.link_text,
        COUNT(*)::BIGINT as link_count
    FROM document_links dl
    JOIN documents d ON d.id = dl.source_document_id
    WHERE dl.target_document_id = p_document_id
    GROUP BY d.id, d.title, dl.link_type, dl.link_text
    ORDER BY link_count DESC, d.title;
END;
$$ LANGUAGE plpgsql;

-- Function to get all documents linked from a specific document (outgoing links)
CREATE OR REPLACE FUNCTION get_document_outgoing_links(p_document_id UUID)
RETURNS TABLE (
    document_id UUID,
    title TEXT,
    link_type TEXT,
    link_text TEXT,
    position_start INTEGER,
    position_end INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as document_id,
        d.title,
        dl.link_type,
        dl.link_text,
        dl.position_start,
        dl.position_end
    FROM document_links dl
    JOIN documents d ON d.id = dl.target_document_id
    WHERE dl.source_document_id = p_document_id
    ORDER BY dl.position_start;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_document_links_updated_at
    BEFORE UPDATE ON document_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();