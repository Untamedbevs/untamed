-- Add is_private flag to media table for private S3 files
ALTER TABLE media ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_media_is_private ON media(is_private);
