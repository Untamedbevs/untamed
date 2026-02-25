-- ============================================
-- Untamed Beverages - Initial Schema
-- ============================================

-- Staff table (linked to Supabase Auth)
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'contractor')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_auth_user_id ON staff(auth_user_id);
CREATE INDEX idx_staff_role ON staff(role);

-- Ideas table
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('social', 'marketing', 'strategy', 'product', 'event', 'partnership', 'other')),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'developing', 'ready', 'in_progress', 'completed', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES staff(id),
  assigned_to UUID REFERENCES staff(id),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ideas_category ON ideas(category);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_priority ON ideas(priority);
CREATE INDEX idx_ideas_assigned_to ON ideas(assigned_to);
CREATE INDEX idx_ideas_created_by ON ideas(created_by);

-- Media table (S3-backed)
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document')),
  mime_type TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  tags TEXT[] DEFAULT '{}',
  folder TEXT DEFAULT '/',
  uploaded_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_media_file_type ON media(file_type);
CREATE INDEX idx_media_folder ON media(folder);
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'archived')),
  category TEXT CHECK (category IN ('product_launch', 'brand_awareness', 'engagement', 'event', 'promotion', 'seasonal', 'other')),
  platforms TEXT[] NOT NULL DEFAULT '{}',
  scheduled_date TIMESTAMPTZ,
  posted_date TIMESTAMPTZ,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_category ON campaigns(category);
CREATE INDEX idx_campaigns_scheduled_date ON campaigns(scheduled_date);
CREATE INDEX idx_campaigns_idea_id ON campaigns(idea_id);

-- Campaign media junction table
CREATE TABLE campaign_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  platform_variant TEXT,
  UNIQUE(campaign_id, media_id)
);

CREATE INDEX idx_campaign_media_campaign_id ON campaign_media(campaign_id);
CREATE INDEX idx_campaign_media_media_id ON campaign_media(media_id);

-- ============================================
-- Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_media ENABLE ROW LEVEL SECURITY;

-- Staff: authenticated users who are active staff can read
CREATE POLICY "Staff can read own record"
  ON staff FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Service role bypasses RLS, so admin operations work without extra policies.
-- For authenticated staff to read all data, we add broad read policies:

CREATE POLICY "Active staff can read all ideas"
  ON ideas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can insert ideas"
  ON ideas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can update ideas"
  ON ideas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Admins can delete ideas"
  ON ideas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Active staff can read all media"
  ON media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can insert media"
  ON media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can update media"
  ON media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Admins can delete media"
  ON media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Active staff can read all campaigns"
  ON campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can update campaigns"
  ON campaigns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Admins can delete campaigns"
  ON campaigns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Active staff can read campaign_media"
  ON campaign_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Active staff can manage campaign_media"
  ON campaign_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );
