-- Add tags support for scraps

-- Create tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create scrap_post_tags junction table
CREATE TABLE scrap_post_tags (
    scrap_post_id UUID NOT NULL REFERENCES scrap_posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scrap_post_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX idx_tags_name ON tags(LOWER(name));
CREATE INDEX idx_scrap_post_tags_tag_id ON scrap_post_tags(tag_id);
CREATE INDEX idx_scrap_post_tags_scrap_post_id ON scrap_post_tags(scrap_post_id);

-- Function to normalize tag names (lowercase, trim whitespace)
CREATE OR REPLACE FUNCTION normalize_tag_name(tag_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(tag_name));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to normalize tag names before insert/update
CREATE OR REPLACE FUNCTION normalize_tag_name_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.name = normalize_tag_name(NEW.name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_tag_name_before_insert_update
BEFORE INSERT OR UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION normalize_tag_name_trigger();