-- Create document_updates table for storing current CRDT state
CREATE TABLE IF NOT EXISTS document_updates (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    update_data BYTEA NOT NULL,
    state_vector BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create document_update_history table for storing incremental updates
CREATE TABLE IF NOT EXISTS document_update_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    update_data BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for history queries
CREATE INDEX idx_document_update_history_document_id ON document_update_history(document_id);
CREATE INDEX idx_document_update_history_created_at ON document_update_history(created_at);
CREATE INDEX idx_document_update_history_composite ON document_update_history(document_id, created_at);

-- Create document_awareness table for storing awareness states
CREATE TABLE IF NOT EXISTS document_awareness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, client_id)
);

-- Create indexes for awareness queries
CREATE INDEX idx_document_awareness_document_id ON document_awareness(document_id);
CREATE INDEX idx_document_awareness_last_seen ON document_awareness(last_seen);