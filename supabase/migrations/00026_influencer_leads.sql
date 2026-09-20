-- Influencer / creator partnership applications.
-- Separate from distributor_leads so wholesale and social inbound stay distinct.

CREATE TABLE influencer_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  primary_platform TEXT NOT NULL CHECK (primary_platform IN (
    'instagram', 'tiktok', 'youtube', 'other'
  )),
  handle TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  other_handles TEXT,
  follower_tier TEXT NOT NULL CHECK (follower_tier IN (
    'nano', 'micro', 'mid', 'macro'
  )),
  content_focus TEXT NOT NULL CHECK (content_focus IN (
    'nightlife', 'food', 'hosting', 'lifestyle', 'fashion', 'music', 'fitness', 'other'
  )),
  compensation TEXT NOT NULL DEFAULT 'open' CHECK (compensation IN (
    'open', 'gifted', 'paid', 'affiliate'
  )),
  content_link TEXT,
  message TEXT,
  is_21 BOOLEAN NOT NULL DEFAULT false,
  audience_is_21 BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'reviewing', 'outreach', 'negotiating', 'active', 'declined'
  )),
  admin_notes TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  first_contacted_at TIMESTAMPTZ,
  event_id TEXT,
  visitor_fingerprint TEXT,
  session_id TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  first_utm_term TEXT,
  first_gclid TEXT,
  first_fbclid TEXT,
  first_landing_page TEXT,
  first_referrer TEXT,
  converting_utm_source TEXT,
  converting_utm_medium TEXT,
  converting_utm_campaign TEXT,
  converting_gclid TEXT,
  converting_fbclid TEXT,
  converting_landing_page TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_influencer_leads_status ON influencer_leads(status, created_at DESC);
CREATE INDEX idx_influencer_leads_email ON influencer_leads(email);
CREATE INDEX idx_influencer_leads_platform ON influencer_leads(primary_platform);
CREATE INDEX idx_influencer_leads_visitor
  ON influencer_leads(visitor_fingerprint)
  WHERE visitor_fingerprint IS NOT NULL;
CREATE INDEX idx_influencer_leads_first_utm_source
  ON influencer_leads(first_utm_source)
  WHERE first_utm_source IS NOT NULL;

CREATE TRIGGER influencer_leads_updated_at
  BEFORE UPDATE ON influencer_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE influencer_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read influencer leads"
  ON influencer_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can update influencer leads"
  ON influencer_leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );
