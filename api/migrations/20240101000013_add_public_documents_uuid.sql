-- Add persistent public document functionality with UUID-based URLs
-- This allows documents to be published at /@username/document-id URLs

-- Remove old slug-related columns and constraints if they exist
DO $$ 
BEGIN
    -- Drop old triggers and functions
    DROP TRIGGER IF EXISTS trigger_set_public_slug ON documents;
    DROP FUNCTION IF EXISTS set_public_slug();
    DROP FUNCTION IF EXISTS generate_public_slug(TEXT, UUID);
    
    -- Drop old constraints
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS check_public_slug_format;
    
    -- Drop old indexes
    DROP INDEX IF EXISTS idx_documents_public_slug;
    
    -- Drop the public_slug column if it exists
    ALTER TABLE documents DROP COLUMN IF EXISTS public_slug;
END $$;

-- Add visibility column to documents table (for public/private state)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='visibility') THEN
        ALTER TABLE documents ADD COLUMN visibility TEXT DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text]));
    END IF;
END $$;

-- Add published_at column to documents table (for tracking when made public)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='published_at') THEN
        ALTER TABLE documents ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add username column to users table for public URLs (/@username/document-id)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;
        
        -- Set default usernames for existing users based on email
        UPDATE users SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9]', '', 'g'))
        WHERE username IS NULL;
        
        -- Make username NOT NULL after setting defaults
        ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    END IF;
END $$;

-- Create indexes for public document queries
CREATE INDEX IF NOT EXISTS idx_documents_visibility_public ON documents(visibility, owner_id) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Add constraint for username format
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='check_username_format') THEN
        ALTER TABLE users ADD CONSTRAINT check_username_format
            CHECK (username ~ '^[a-z0-9][a-z0-9\-_]*[a-z0-9]$|^[a-z0-9]$');
    END IF;
END $$;