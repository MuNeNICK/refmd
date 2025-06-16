-- Make document_id nullable in attachments table
ALTER TABLE attachments 
ALTER COLUMN document_id DROP NOT NULL;

-- Update foreign key constraint to allow NULL
ALTER TABLE attachments
DROP CONSTRAINT IF EXISTS attachments_document_id_fkey;

ALTER TABLE attachments
ADD CONSTRAINT attachments_document_id_fkey
FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;