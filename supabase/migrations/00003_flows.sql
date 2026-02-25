-- ============================================
-- Campaign Flow Studio - Flows & Flow Posts
-- ============================================

-- Flows table: a planned content sequence
CREATE TABLE flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  concept TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'generating', 'reviewing', 'complete')),
  platform_targets TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES staff(id),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_flows_status ON flows(status);
CREATE INDEX idx_flows_created_by ON flows(created_by);
CREATE INDEX idx_flows_campaign_id ON flows(campaign_id);

-- Flow posts: individual posts within a flow
CREATE TABLE flow_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  concept TEXT NOT NULL,
  prompt TEXT NOT NULL,
  generation_mode TEXT NOT NULL DEFAULT 'generate' CHECK (generation_mode IN ('generate', 'edit', 'video')),
  target_size TEXT DEFAULT 'square_1_1' CHECK (target_size IN ('square_1_1', 'landscape_16_9', 'portrait_9_16', 'story_4_5')),
  reference_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  generated_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'complete', 'approved', 'rejected')),
  fal_model TEXT,
  generation_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_flow_posts_flow_id ON flow_posts(flow_id);
CREATE INDEX idx_flow_posts_status ON flow_posts(status);
CREATE INDEX idx_flow_posts_sort_order ON flow_posts(flow_id, sort_order);

-- Updated_at triggers
CREATE TRIGGER flows_updated_at
  BEFORE UPDATE ON flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER flow_posts_updated_at
  BEFORE UPDATE ON flow_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff can read all flows"
  ON flows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can insert flows"
  ON flows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can update flows"
  ON flows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Admins can delete flows"
  ON flows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Active staff can manage flow_posts"
  ON flow_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );
