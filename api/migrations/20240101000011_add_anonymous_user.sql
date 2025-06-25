-- Create a special anonymous user for share link posts
-- Use a deterministic UUID for the anonymous user
INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    'anonymous@system.local',
    'Anonymous',
    '$2b$12$YDhZT3QvJPRj6S7PzQzQzOqKkPZGQP6TJcY4hJNlHsoaURVxJLV5e', -- dummy hash, login disabled
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;