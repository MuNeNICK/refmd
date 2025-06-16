-- Drop the old document_updates table from the first migration
DROP TABLE IF EXISTS document_updates CASCADE;

-- Recreate document_updates table with the correct schema
CREATE TABLE document_updates (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    update_data BYTEA NOT NULL,
    state_vector BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- No additional indexes needed as document_id is the primary key