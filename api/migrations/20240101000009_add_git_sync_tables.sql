-- Create git_configs table
CREATE TABLE git_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_url TEXT NOT NULL,
    branch_name TEXT NOT NULL DEFAULT 'main',
    auth_type TEXT NOT NULL CHECK (auth_type IN ('ssh', 'token')),
    auth_data JSONB NOT NULL,
    auto_sync BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure only one git config per user
    UNIQUE(user_id)
);

-- Create git_sync_logs table
CREATE TABLE git_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('push', 'pull', 'commit', 'init', 'clone')),
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'in_progress')),
    message TEXT,
    commit_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_git_configs_user_id ON git_configs(user_id);
CREATE INDEX idx_git_sync_logs_user_id ON git_sync_logs(user_id);
CREATE INDEX idx_git_sync_logs_created_at ON git_sync_logs(created_at DESC);
CREATE INDEX idx_git_sync_logs_status ON git_sync_logs(status);

-- Create trigger to update updated_at on git_configs
CREATE OR REPLACE FUNCTION update_git_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_git_configs_updated_at
    BEFORE UPDATE ON git_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_git_configs_updated_at();