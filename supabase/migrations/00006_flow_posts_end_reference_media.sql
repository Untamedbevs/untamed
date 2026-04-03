-- Optional last-frame reference for video posts (e.g. Veo first-last-frame, or future models)

ALTER TABLE flow_posts
  ADD COLUMN IF NOT EXISTS end_reference_media_id UUID REFERENCES media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flow_posts_end_reference_media_id
  ON flow_posts(end_reference_media_id);
