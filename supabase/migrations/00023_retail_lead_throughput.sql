-- Retail lead throughput: attribution on distributor_leads, activity log,
-- tracking events, pageview increments, and daily ad spend.

-- ============================================================================
-- Sessions: persist the client cookie id so leads can join back
-- ============================================================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS client_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_client_session_id
  ON sessions(client_session_id)
  WHERE client_session_id IS NOT NULL;

-- ============================================================================
-- Distributor leads: first-touch + converting attribution
-- ============================================================================
ALTER TABLE distributor_leads
  ADD COLUMN IF NOT EXISTS visitor_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_source TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_content TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_term TEXT,
  ADD COLUMN IF NOT EXISTS first_gclid TEXT,
  ADD COLUMN IF NOT EXISTS first_fbclid TEXT,
  ADD COLUMN IF NOT EXISTS first_landing_page TEXT,
  ADD COLUMN IF NOT EXISTS first_referrer TEXT,
  ADD COLUMN IF NOT EXISTS converting_utm_source TEXT,
  ADD COLUMN IF NOT EXISTS converting_utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS converting_utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS converting_gclid TEXT,
  ADD COLUMN IF NOT EXISTS converting_fbclid TEXT,
  ADD COLUMN IF NOT EXISTS converting_landing_page TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_distributor_leads_visitor
  ON distributor_leads(visitor_fingerprint)
  WHERE visitor_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distributor_leads_first_utm_source
  ON distributor_leads(first_utm_source)
  WHERE first_utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distributor_leads_first_utm_campaign
  ON distributor_leads(first_utm_campaign)
  WHERE first_utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distributor_leads_next_action_at
  ON distributor_leads(next_action_at)
  WHERE next_action_at IS NOT NULL;

-- ============================================================================
-- Lead activity log (CMO workbench)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES distributor_leads(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'created', 'status_change', 'note', 'called', 'emailed',
    'meeting', 'sample_sent', 'next_action'
  )),
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id
  ON lead_activities(lead_id, created_at DESC);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Tracking events (pageview, form_start, form_complete, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_fingerprint TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  page_path TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_type_created
  ON tracking_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_path
  ON tracking_events(page_path, created_at DESC)
  WHERE page_path IS NOT NULL;

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Daily ad spend (manual entry + future Google/Meta sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ad_spend_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'meta', 'other')),
  campaign_name TEXT,
  campaign_id TEXT,
  spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'google_ads', 'meta_ads')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_daily_date
  ON ad_spend_daily(spend_date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_spend_daily_platform_date
  ON ad_spend_daily(platform, spend_date DESC);

ALTER TABLE ad_spend_daily ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS ad_spend_daily_updated_at ON ad_spend_daily;
CREATE TRIGGER ad_spend_daily_updated_at
  BEFORE UPDATE ON ad_spend_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION increment_visitor_pageviews(visitor_fingerprint TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE visitors
  SET total_pageviews = COALESCE(total_pageviews, 0) + 1,
      last_seen_at = now()
  WHERE fingerprint = visitor_fingerprint;
END;
$$;
