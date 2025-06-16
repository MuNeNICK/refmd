-- Add state_vector column if it doesn't exist
ALTER TABLE document_updates ADD COLUMN IF NOT EXISTS state_vector BYTEA NOT NULL DEFAULT E'\\x00';