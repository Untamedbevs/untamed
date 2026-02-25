-- Idea media junction table
CREATE TABLE idea_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(idea_id, media_id)
);

CREATE INDEX idx_idea_media_idea_id ON idea_media(idea_id);
CREATE INDEX idx_idea_media_media_id ON idea_media(media_id);

-- RLS
ALTER TABLE idea_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff can manage idea_media"
  ON idea_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );
