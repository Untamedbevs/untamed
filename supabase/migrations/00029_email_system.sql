-- ============================================================================
-- Untamed Beverages - Email system: templates, saved segments, scheduling,
-- retries and safe queue claiming.
--
-- Builds on 00014 (messaging_campaigns, scheduled_messages, email_messages,
-- email_suppressions). Sending now goes through Google Workspace SMTP.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. email_templates -- reusable subject + body, with {{merge_tags}}
--    kind = 'campaign'      -> shows up in the blast composer
--    kind = 'transactional' -> sent from code via sendTemplateEmail(slug, ...)
-- ============================================================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'campaign' CHECK (kind IN ('campaign', 'transactional')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  preheader TEXT,
  sender_id TEXT,
  default_audience TEXT CHECK (default_audience IN ('loyalty', 'referrers', 'distributors', 'all')),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_templates_kind ON email_templates(kind) WHERE NOT is_archived;

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. email_segments -- saved audience + filter combinations (BlastFilters JSON)
-- ============================================================================
CREATE TABLE email_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  last_count INTEGER,
  last_counted_at TIMESTAMPTZ,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER email_segments_updated_at
  BEFORE UPDATE ON email_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. messaging_campaigns -- link to template/segment, allow scheduling
-- ============================================================================
ALTER TABLE messaging_campaigns
  ADD COLUMN template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  ADD COLUMN segment_id UUID REFERENCES email_segments(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_for TIMESTAMPTZ;

ALTER TABLE messaging_campaigns DROP CONSTRAINT IF EXISTS messaging_campaigns_status_check;
ALTER TABLE messaging_campaigns
  ADD CONSTRAINT messaging_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled'));

-- ============================================================================
-- 4. scheduled_messages -- retry bookkeeping + due-time index
-- ============================================================================
ALTER TABLE scheduled_messages
  ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_attempt_at TIMESTAMPTZ;

CREATE INDEX idx_scheduled_messages_due
  ON scheduled_messages(scheduled_for)
  WHERE status = 'pending';

-- Daily-cap lookups count recent outbound sends.
CREATE INDEX IF NOT EXISTS idx_email_messages_outbound_sent_at
  ON email_messages(sent_at)
  WHERE direction = 'outbound';

-- ============================================================================
-- 5. claim_scheduled_messages -- atomically lease due rows to one worker.
--    FOR UPDATE SKIP LOCKED means overlapping cron runs never double-send.
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_scheduled_messages(p_limit INTEGER)
RETURNS SETOF scheduled_messages
LANGUAGE sql
AS $$
  UPDATE scheduled_messages s
  SET status = 'processing',
      attempts = s.attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  WHERE s.id IN (
    SELECT id FROM scheduled_messages
    WHERE status = 'pending'
      AND message_type = 'email'
      AND (scheduled_for IS NULL OR scheduled_for <= now())
    ORDER BY scheduled_for NULLS FIRST, created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING s.*;
$$;

REVOKE ALL ON FUNCTION claim_scheduled_messages(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_scheduled_messages(INTEGER) TO service_role;

-- ============================================================================
-- RLS (app code uses the service-role client; these guard direct reads)
-- ============================================================================
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email templates"
  ON email_templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));

CREATE POLICY "Staff can read email segments"
  ON email_segments FOR SELECT
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));

-- ============================================================================
-- Seed: the composer's old hard-coded quick-starts, plus a transactional
-- example for orders@.
-- ============================================================================
INSERT INTO email_templates (slug, name, kind, subject, body, default_audience) VALUES
(
  'ugc-call',
  'UGC Call: ask members for photos & videos',
  'campaign',
  'Hey {{first_name}}, show us how you Unleash It',
  E'Hey {{first_name}},\n\nWe''re collecting photos and videos from real Untamed moments — yours could be featured on our site, social, or even a future can.\n\nGot a clip of you cracking open a Cougar at sunset, or a Cheetah on the boat? We want it.\n\nSubmit in 30 seconds:\n{{portal_login_url}}\n\nThe best ones get featured on the site for the whole pack to see.\n\nSee what others are sharing: {{community_url}}\n\nStay wild,\nThe Untamed crew',
  'loyalty'
),
(
  'ugc-thank-you',
  'UGC Thank-you: appreciate recent contributors',
  'campaign',
  'Thanks for sharing, {{first_name}}',
  E'{{first_name}},\n\nThank you for sharing your Untamed moment with us. Your submission is what keeps this brand grounded in real people.\n\nYou can keep tabs on your submissions and points here:\n{{portal_login_url}}\n\nStay wild,\nThe Untamed crew',
  'loyalty'
),
(
  'ugc-distributor-call',
  'UGC Call (Distributors): ask partners for shelf shots',
  'campaign',
  'Show us Untamed in your shop, {{first_name}}',
  E'{{first_name}},\n\nA quick favor: we''re building a partner gallery and would love to see Untamed on your shelves, your bar, or in customers'' hands.\n\nSnap a few photos or a short video and submit through your partner portal:\n{{portal_login_url}}\n\nWe''ll spotlight the best ones across our channels.\n\nThanks,\nThe Untamed team',
  'distributors'
),
(
  'order-update',
  'Order update (orders@)',
  'transactional',
  'An update on your Untamed order {{order_number}}',
  E'Hey {{first_name}},\n\n{{message}}\n\nOrder: **{{order_number}}**\n\nQuestions? Just reply to this email.\n\nStay wild,\nThe Untamed crew',
  NULL
);

UPDATE email_templates SET sender_id = 'orders' WHERE slug = 'order-update';

INSERT INTO email_segments (name, description, filters) VALUES
  ('All loyalty members', 'Everyone in the loyalty program', '{"audience":"loyalty"}'),
  ('UGC contributors', 'Loyalty members with at least one UGC submission', '{"audience":"loyalty","min_ugc_submissions":1}'),
  ('All distributor leads', 'Every B2B / retail prospect', '{"audience":"distributors"}');

COMMIT;
