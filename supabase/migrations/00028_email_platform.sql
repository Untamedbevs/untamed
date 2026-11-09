-- ============================================================================
-- Untamed Beverages - Email platform (roadmap phases 3-6)
--
--   Phase 3: double opt-in signup requests, preferences (topics, pause, birthday)
--   Phase 4: templates, scheduling, order + engagement tracking on contacts,
--            sunset and pause rules, automated flows, reporting functions
--   Phase 5: Gmail sync state, outreach sequences, inbound/outreach logging
--   Phase 6: settings (kill switch, caps, thresholds), approvals, alerts,
--            staff audit log, retention
--
-- Requires 00027. Every new automation ships switched off: flows are seeded
-- as 'draft' and nothing sends until staff activate it.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Settings (one row). Staff-editable policy; secrets stay in env.
-- ============================================================================
CREATE TABLE email_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  -- Kill switch: stops all marketing sends (blasts and marketing flows).
  marketing_paused BOOLEAN NOT NULL DEFAULT false,
  marketing_paused_reason TEXT,
  marketing_paused_at TIMESTAMPTZ,
  -- Max marketing emails one person receives in 7 days (blasts + flows).
  weekly_frequency_cap INTEGER NOT NULL DEFAULT 3 CHECK (weekly_frequency_cap BETWEEN 1 AND 50),
  -- No marketing sends between these local hours (recipient time zone).
  quiet_hours_start SMALLINT NOT NULL DEFAULT 21 CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end SMALLINT NOT NULL DEFAULT 8 CHECK (quiet_hours_end BETWEEN 0 AND 23),
  default_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  -- Sunset: stop marketing to people who haven't opened or clicked in
  -- sunset_days after at least sunset_min_sends emails.
  sunset_days INTEGER NOT NULL DEFAULT 180 CHECK (sunset_days >= 30),
  sunset_min_sends INTEGER NOT NULL DEFAULT 8 CHECK (sunset_min_sends >= 1),
  -- Blasts larger than this need a second admin's approval.
  approval_threshold INTEGER NOT NULL DEFAULT 500 CHECK (approval_threshold >= 0),
  -- Auto-pause a campaign whose complaint or hard-bounce rate passes these.
  complaint_pause_rate NUMERIC(6,5) NOT NULL DEFAULT 0.003,
  bounce_pause_rate NUMERIC(6,5) NOT NULL DEFAULT 0.05,
  -- Retention: email bodies are cleared after this many days (metadata kept).
  retention_body_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_body_days >= 30),
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO email_settings DEFAULT VALUES;

-- ============================================================================
-- 2. Contacts: preferences, order history, engagement
-- ============================================================================
ALTER TABLE email_contacts
  ADD COLUMN birthday_month SMALLINT CHECK (birthday_month BETWEEN 1 AND 12),
  ADD COLUMN birthday_day SMALLINT CHECK (birthday_day BETWEEN 1 AND 31),
  ADD COLUMN timezone TEXT,
  ADD COLUMN state_code TEXT CHECK (state_code ~ '^[A-Z]{2}$'),
  ADD COLUMN marketing_paused_until TIMESTAMPTZ,
  -- Previous orders (from loyalty_orders, kept current by trigger).
  ADD COLUMN order_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN first_order_at TIMESTAMPTZ,
  ADD COLUMN last_order_at TIMESTAMPTZ,
  ADD COLUMN total_spent_cents BIGINT NOT NULL DEFAULT 0,
  -- Engagement (opens, clicks, replies) for sunset and segments.
  ADD COLUMN last_engaged_at TIMESTAMPTZ,
  ADD COLUMN last_marketing_sent_at TIMESTAMPTZ,
  ADD COLUMN marketing_sends_since_engaged INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_email_contacts_last_order_at ON email_contacts(last_order_at) WHERE last_order_at IS NOT NULL;
CREATE INDEX idx_email_contacts_birthday ON email_contacts(birthday_month, birthday_day) WHERE birthday_month IS NOT NULL;

-- US state from a ZIP code's first three digits (USPS prefix ranges).
CREATE OR REPLACE FUNCTION email_zip_to_state(p_zip TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  z INTEGER;
BEGIN
  IF p_zip IS NULL OR substring(btrim(p_zip) FROM 1 FOR 3) !~ '^[0-9]{3}$' THEN
    RETURN NULL;
  END IF;
  z := substring(btrim(p_zip) FROM 1 FOR 3)::INTEGER;
  RETURN CASE
    WHEN z = 5 THEN 'NY'
    WHEN z BETWEEN 6 AND 9 THEN 'PR'
    WHEN z BETWEEN 10 AND 27 THEN 'MA'
    WHEN z BETWEEN 28 AND 29 THEN 'RI'
    WHEN z BETWEEN 30 AND 38 THEN 'NH'
    WHEN z BETWEEN 39 AND 49 THEN 'ME'
    WHEN z BETWEEN 50 AND 59 THEN 'VT'
    WHEN z BETWEEN 60 AND 69 THEN 'CT'
    WHEN z BETWEEN 70 AND 89 THEN 'NJ'
    WHEN z BETWEEN 100 AND 149 THEN 'NY'
    WHEN z BETWEEN 150 AND 196 THEN 'PA'
    WHEN z BETWEEN 197 AND 199 THEN 'DE'
    WHEN z = 200 OR z BETWEEN 202 AND 205 OR z = 569 THEN 'DC'
    WHEN z = 201 OR z BETWEEN 220 AND 246 THEN 'VA'
    WHEN z BETWEEN 206 AND 219 THEN 'MD'
    WHEN z BETWEEN 247 AND 268 THEN 'WV'
    WHEN z BETWEEN 270 AND 289 THEN 'NC'
    WHEN z BETWEEN 290 AND 299 THEN 'SC'
    WHEN z BETWEEN 300 AND 319 OR z BETWEEN 398 AND 399 THEN 'GA'
    WHEN z BETWEEN 320 AND 349 THEN 'FL'
    WHEN z BETWEEN 350 AND 369 THEN 'AL'
    WHEN z BETWEEN 370 AND 385 THEN 'TN'
    WHEN z BETWEEN 386 AND 397 THEN 'MS'
    WHEN z BETWEEN 400 AND 427 THEN 'KY'
    WHEN z BETWEEN 430 AND 459 THEN 'OH'
    WHEN z BETWEEN 460 AND 479 THEN 'IN'
    WHEN z BETWEEN 480 AND 499 THEN 'MI'
    WHEN z BETWEEN 500 AND 528 THEN 'IA'
    WHEN z BETWEEN 530 AND 549 THEN 'WI'
    WHEN z BETWEEN 550 AND 567 THEN 'MN'
    WHEN z BETWEEN 570 AND 577 THEN 'SD'
    WHEN z BETWEEN 580 AND 588 THEN 'ND'
    WHEN z BETWEEN 590 AND 599 THEN 'MT'
    WHEN z BETWEEN 600 AND 629 THEN 'IL'
    WHEN z BETWEEN 630 AND 658 THEN 'MO'
    WHEN z BETWEEN 660 AND 679 THEN 'KS'
    WHEN z BETWEEN 680 AND 693 THEN 'NE'
    WHEN z BETWEEN 700 AND 714 THEN 'LA'
    WHEN z BETWEEN 716 AND 729 THEN 'AR'
    WHEN z = 733 OR z BETWEEN 750 AND 799 OR z = 885 THEN 'TX'
    WHEN z BETWEEN 730 AND 749 THEN 'OK'
    WHEN z BETWEEN 800 AND 816 THEN 'CO'
    WHEN z BETWEEN 820 AND 831 THEN 'WY'
    WHEN z BETWEEN 832 AND 838 THEN 'ID'
    WHEN z BETWEEN 840 AND 847 THEN 'UT'
    WHEN z BETWEEN 850 AND 865 THEN 'AZ'
    WHEN z BETWEEN 870 AND 884 THEN 'NM'
    WHEN z BETWEEN 889 AND 898 THEN 'NV'
    WHEN z BETWEEN 900 AND 961 THEN 'CA'
    WHEN z BETWEEN 967 AND 968 THEN 'HI'
    WHEN z = 969 THEN 'GU'
    WHEN z BETWEEN 970 AND 979 THEN 'OR'
    WHEN z BETWEEN 980 AND 994 THEN 'WA'
    WHEN z BETWEEN 995 AND 999 THEN 'AK'
    ELSE NULL
  END;
END;
$$;

-- Recompute one contact's order history from loyalty_orders.
CREATE OR REPLACE FUNCTION email_refresh_order_stats(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email TEXT := email_normalize(p_email);
BEGIN
  IF v_email IS NULL THEN RETURN; END IF;
  UPDATE email_contacts c SET
    order_count = s.n,
    first_order_at = s.first_at,
    last_order_at = s.last_at,
    total_spent_cents = s.spent,
    state_code = coalesce(s.state, c.state_code)
  FROM (
    SELECT count(*)::INTEGER AS n,
           min(created_at) AS first_at,
           max(created_at) AS last_at,
           coalesce(sum(total_cents), 0)::BIGINT AS spent,
           (array_agg(
              email_zip_to_state(coalesce(
                raw_payload #>> '{shippingDetail,zip}',
                raw_payload #>> '{buyerDetail,zip}'
              )) ORDER BY created_at DESC)
            FILTER (WHERE email_zip_to_state(coalesce(
                raw_payload #>> '{shippingDetail,zip}',
                raw_payload #>> '{buyerDetail,zip}')) IS NOT NULL))[1] AS state
      FROM loyalty_orders
     WHERE lower(btrim(email)) = v_email
  ) s
  WHERE c.email = v_email;
END;
$$;

CREATE OR REPLACE FUNCTION email_order_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM email_refresh_order_stats(NEW.email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email order stats failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Fires after loyalty_orders_email_contact_sync (trigger names sort that way).
CREATE TRIGGER loyalty_orders_email_order_stats
  AFTER INSERT OR UPDATE OF email, total_cents ON loyalty_orders
  FOR EACH ROW EXECUTE FUNCTION email_order_stats_trigger();

-- ============================================================================
-- 3. Double opt-in signup requests (website forms)
-- The token itself is emailed; only its SHA-256 is stored.
-- ============================================================================
CREATE TABLE email_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (email = email_normalize(email)),
  lists TEXT[] NOT NULL CHECK (cardinality(lists) > 0),
  first_name TEXT,
  source_detail TEXT,
  consent_text TEXT NOT NULL,
  consent_text_version TEXT NOT NULL,
  age_attested BOOLEAN NOT NULL DEFAULT false,
  age_text TEXT,
  birthday_month SMALLINT CHECK (birthday_month BETWEEN 1 AND 12),
  birthday_day SMALLINT CHECK (birthday_day BETWEEN 1 AND 31),
  timezone TEXT,
  ip_address INET,
  user_agent TEXT,
  country_code TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX idx_email_signup_requests_email ON email_signup_requests(email, created_at DESC);
CREATE INDEX idx_email_signup_requests_ip ON email_signup_requests(ip_address, created_at DESC);

-- ============================================================================
-- 4. Templates (block-based content)
-- ============================================================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'campaign' CHECK (category IN ('campaign', 'flow', 'outreach')),
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. Campaigns: content, scheduling, approvals, pausing
-- ============================================================================
ALTER TABLE messaging_campaigns DROP CONSTRAINT IF EXISTS messaging_campaigns_status_check;
ALTER TABLE messaging_campaigns ADD CONSTRAINT messaging_campaigns_status_check
  CHECK (status IN ('draft', 'pending_approval', 'scheduled', 'sending', 'paused', 'sent', 'cancelled'));

ALTER TABLE messaging_campaigns
  ADD COLUMN template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  ADD COLUMN blocks JSONB,
  ADD COLUMN preheader TEXT,
  ADD COLUMN scheduled_for TIMESTAMPTZ,
  ADD COLUMN utm_campaign TEXT,
  ADD COLUMN approval_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN submitted_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN submitted_at TIMESTAMPTZ,
  ADD COLUMN approved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN rejected_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN rejected_at TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN paused_at TIMESTAMPTZ,
  ADD COLUMN paused_reason TEXT,
  ADD COLUMN check_results JSONB;

-- ============================================================================
-- 6. Message log: flows, outreach, Gmail
-- ============================================================================
ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_stream_check;
ALTER TABLE email_messages ADD CONSTRAINT email_messages_stream_check
  CHECK (stream IN ('marketing', 'transactional', 'outreach'));
ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_transport_check;
ALTER TABLE email_messages ADD CONSTRAINT email_messages_transport_check
  CHECK (transport IN ('smtp', 'ses', 'gmail'));

ALTER TABLE email_messages
  ADD COLUMN flow_slug TEXT,
  ADD COLUMN flow_step_id UUID,
  ADD COLUMN flow_enrollment_id UUID,
  ADD COLUMN outreach_enrollment_id UUID,
  ADD COLUMN gmail_message_id TEXT,
  ADD COLUMN gmail_thread_id TEXT,
  ADD COLUMN mailbox TEXT,
  ADD COLUMN rfc_message_id TEXT,
  ADD COLUMN in_reply_to TEXT;

CREATE UNIQUE INDEX idx_email_messages_gmail_message
  ON email_messages(mailbox, gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX idx_email_messages_gmail_thread ON email_messages(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;
CREATE INDEX idx_email_messages_flow ON email_messages(flow_slug, sent_at DESC) WHERE flow_slug IS NOT NULL;
CREATE INDEX idx_email_messages_clicked ON email_messages(to_email, clicked_at) WHERE clicked_at IS NOT NULL;
CREATE INDEX idx_email_messages_from ON email_messages(from_email) WHERE direction = 'inbound';

-- Engagement bookkeeping on contacts.
CREATE OR REPLACE FUNCTION email_message_engagement_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact UUID := NEW.email_contact_id;
BEGIN
  BEGIN
    IF v_contact IS NULL THEN
      SELECT id INTO v_contact FROM email_contacts
       WHERE email = CASE WHEN NEW.direction = 'inbound' THEN lower(btrim(NEW.from_email)) ELSE NEW.to_email END;
    END IF;
    IF v_contact IS NULL THEN RETURN NEW; END IF;

    IF TG_OP = 'INSERT' THEN
      IF NEW.direction = 'inbound' THEN
        UPDATE email_contacts
           SET last_engaged_at = greatest(coalesce(last_engaged_at, NEW.sent_at), NEW.sent_at),
               marketing_sends_since_engaged = 0
         WHERE id = v_contact;
      ELSIF NEW.stream = 'marketing' THEN
        UPDATE email_contacts
           SET last_marketing_sent_at = greatest(coalesce(last_marketing_sent_at, NEW.sent_at), NEW.sent_at),
               marketing_sends_since_engaged = marketing_sends_since_engaged + 1
         WHERE id = v_contact;
      END IF;
    ELSIF NEW.open_count > OLD.open_count OR NEW.click_count > OLD.click_count THEN
      UPDATE email_contacts
         SET last_engaged_at = greatest(coalesce(last_engaged_at, NEW.last_event_at, now()), coalesce(NEW.last_event_at, now())),
             marketing_sends_since_engaged = 0
       WHERE id = v_contact;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email engagement bookkeeping failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER email_messages_engagement_insert
  AFTER INSERT ON email_messages
  FOR EACH ROW EXECUTE FUNCTION email_message_engagement_trigger();
CREATE TRIGGER email_messages_engagement_update
  AFTER UPDATE OF open_count, click_count ON email_messages
  FOR EACH ROW EXECUTE FUNCTION email_message_engagement_trigger();

-- ============================================================================
-- 7. Marketing recipients: add pause and sunset rules
-- ============================================================================
DROP FUNCTION IF EXISTS email_marketing_recipients(TEXT, TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION email_marketing_recipients(
  p_list_slug TEXT,
  p_allowed_countries TEXT[] DEFAULT ARRAY['US'],
  p_emails TEXT[] DEFAULT NULL,
  p_sunset_days INTEGER DEFAULT NULL,
  p_sunset_min_sends INTEGER DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  loyalty_member_id UUID,
  referral_participant_id UUID,
  distributor_lead_id UUID
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.email, c.first_name, c.last_name,
         c.loyalty_member_id, c.referral_participant_id, c.distributor_lead_id
    FROM email_contacts c
    JOIN email_consents ec
      ON ec.contact_id = c.id AND ec.list_slug = p_list_slug AND ec.status = 'subscribed'
    JOIN email_lists l
      ON l.slug = ec.list_slug AND l.is_active
   WHERE (NOT l.requires_age_verification OR c.age_verified_at IS NOT NULL)
     AND (c.country_code IS NULL OR p_allowed_countries IS NULL OR c.country_code = ANY(p_allowed_countries))
     AND (c.marketing_paused_until IS NULL OR c.marketing_paused_until <= now())
     AND NOT (
       p_sunset_days IS NOT NULL AND p_sunset_min_sends IS NOT NULL
       AND c.marketing_sends_since_engaged >= p_sunset_min_sends
       AND coalesce(c.last_engaged_at, ec.subscribed_at, c.created_at) < now() - make_interval(days => p_sunset_days)
     )
     AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE lower(s.email) = c.email)
     AND (p_emails IS NULL OR c.email = ANY(p_emails))
   ORDER BY c.created_at, c.id
$$;

-- Marketing emails each address received since p_since (frequency cap).
CREATE OR REPLACE FUNCTION email_recent_marketing_counts(p_emails TEXT[], p_since TIMESTAMPTZ)
RETURNS TABLE (email TEXT, sent INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_email, count(*)::INTEGER
    FROM email_messages
   WHERE stream = 'marketing'
     AND direction = 'outbound'
     AND sent_at >= p_since
     AND to_email = ANY(p_emails)
   GROUP BY to_email
$$;

-- ============================================================================
-- 8. Automated flows
-- ============================================================================
CREATE TABLE email_flows (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9_]+$'),
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL CHECK (trigger IN (
    'list_opt_in', 'order_placed', 'order_lapsed', 'points_balance',
    'referral_credit', 'redemption_created', 'redemption_fulfilled',
    'birthday', 'cart_abandoned'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- marketing = needs an opt-in to list_slug; transactional = account
  -- notices (credit earned, redemption status) that still honor suppressions.
  stream TEXT NOT NULL CHECK (stream IN ('marketing', 'transactional')),
  list_slug TEXT REFERENCES email_lists(slug) ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'unavailable')),
  sender_id TEXT NOT NULL DEFAULT 'loyalty',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (stream = 'transactional' OR list_slug IS NOT NULL)
);
CREATE TRIGGER email_flows_updated_at
  BEFORE UPDATE ON email_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE email_flow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_slug TEXT NOT NULL REFERENCES email_flows(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order >= 1),
  -- Wait after enrollment (first step) or after the previous step.
  delay_hours INTEGER NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
  subject TEXT NOT NULL,
  preheader TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  -- Overrides the flow's consent list for this step (marketing flows).
  list_slug TEXT REFERENCES email_lists(slug) ON UPDATE CASCADE,
  -- Exit instead of sending when this is true at send time.
  exit_if TEXT CHECK (exit_if IN ('ordered_since_enrollment', 'redeemed_since_enrollment', 'balance_below_min_reward')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_slug, step_order)
);
CREATE TRIGGER email_flow_steps_updated_at
  BEFORE UPDATE ON email_flow_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE email_flow_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_slug TEXT NOT NULL REFERENCES email_flows(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  contact_id UUID REFERENCES email_contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  -- One enrollment per trigger occurrence (e.g. one order, one credit).
  trigger_key TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'exited', 'cancelled')),
  next_step_order INTEGER,
  next_run_at TIMESTAMPTZ,
  exit_reason TEXT,
  steps_sent INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_slug, trigger_key)
);
CREATE INDEX idx_email_flow_enrollments_due ON email_flow_enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX idx_email_flow_enrollments_email ON email_flow_enrollments(email);
CREATE TRIGGER email_flow_enrollments_updated_at
  BEFORE UPDATE ON email_flow_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enroll an address in an active flow. Returns the enrollment id, or NULL when
-- the flow isn't active, has no steps, or this trigger already enrolled.
CREATE OR REPLACE FUNCTION email_flow_enroll(
  p_flow TEXT,
  p_email TEXT,
  p_trigger_key TEXT,
  p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email TEXT := email_normalize(p_email);
  v_step RECORD;
  v_contact UUID;
  v_id UUID;
BEGIN
  IF v_email IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM email_flows WHERE slug = p_flow AND status = 'active') THEN
    RETURN NULL;
  END IF;

  SELECT step_order, delay_hours INTO v_step
    FROM email_flow_steps
   WHERE flow_slug = p_flow AND is_active
   ORDER BY step_order
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_contact FROM email_contacts WHERE email = v_email;

  INSERT INTO email_flow_enrollments (flow_slug, contact_id, email, trigger_key, context, next_step_order, next_run_at)
  VALUES (p_flow, v_contact, v_email, p_trigger_key, coalesce(p_context, '{}'::jsonb),
          v_step.step_order, now() + make_interval(hours => v_step.delay_hours))
  ON CONFLICT (flow_slug, trigger_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Event triggers. Each enrolls best-effort and never blocks the source write.
CREATE OR REPLACE FUNCTION email_flow_event_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_balance INTEGER;
  v_items JSONB;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'email_consent_events' THEN
      -- Welcome: the first time someone opts in to a consumer list. Historic
      -- opt-ins recorded by a backfill don't get a welcome months later.
      IF NEW.action = 'opt_in' AND coalesce(NEW.source_detail, '') NOT LIKE '%recorded by backfill%' AND EXISTS (
        SELECT 1 FROM email_lists WHERE slug = NEW.list_slug AND audience = 'consumer'
      ) THEN
        PERFORM email_flow_enroll('welcome', NEW.email, 'welcome:' || NEW.contact_id::TEXT,
          jsonb_build_object('list_slug', NEW.list_slug));
      END IF;

    ELSIF TG_TABLE_NAME = 'loyalty_orders' THEN
      v_email := email_normalize(NEW.email);
      IF v_email IS NULL THEN RETURN NEW; END IF;
      v_items := coalesce((
        SELECT jsonb_agg(DISTINCT it ->> 'title') FROM jsonb_array_elements(coalesce(NEW.items, '[]'::jsonb)) it
         WHERE it ->> 'title' IS NOT NULL), '[]'::jsonb);
      -- A new order ends any win-back in progress.
      UPDATE email_flow_enrollments
         SET status = 'exited', exit_reason = 'ordered', next_run_at = NULL
       WHERE email = v_email AND status = 'active'
         AND flow_slug IN (SELECT slug FROM email_flows WHERE trigger = 'order_lapsed');
      PERFORM email_flow_enroll('post_purchase', v_email, 'order:' || NEW.accelpay_sale_id::TEXT,
        jsonb_build_object('sale_id', NEW.accelpay_sale_id, 'items', v_items,
                           'total_cents', NEW.total_cents, 'ordered_at', NEW.created_at));

    ELSIF TG_TABLE_NAME = 'loyalty_transactions' THEN
      IF NEW.type IN ('referral_signup', 'referral_purchase') AND NEW.points > 0 THEN
        SELECT email, points_balance INTO v_email, v_balance FROM loyalty_members WHERE id = NEW.member_id;
        PERFORM email_flow_enroll('referral_credit', v_email, 'txn:' || NEW.id::TEXT,
          jsonb_build_object('points', NEW.points, 'reason', NEW.type, 'description', NEW.description,
                             'member_id', NEW.member_id, 'credited_at', NEW.created_at));
      END IF;

    ELSIF TG_TABLE_NAME = 'loyalty_redemptions' THEN
      SELECT email INTO v_email FROM loyalty_members WHERE id = NEW.member_id;
      IF TG_OP = 'INSERT' THEN
        PERFORM email_flow_enroll('redemption_received', v_email, 'redemption:' || NEW.id::TEXT,
          jsonb_build_object('redemption_id', NEW.id, 'reward', NEW.reward_label,
                             'points_cost', NEW.points_cost, 'member_id', NEW.member_id));
      ELSIF NEW.status::TEXT = 'fulfilled' AND OLD.status::TEXT IS DISTINCT FROM 'fulfilled' THEN
        PERFORM email_flow_enroll('redemption_fulfilled', v_email, 'redemption_fulfilled:' || NEW.id::TEXT,
          jsonb_build_object('redemption_id', NEW.id, 'reward', NEW.reward_label,
                             'points_cost', NEW.points_cost, 'member_id', NEW.member_id));
      ELSIF NEW.status::TEXT = 'cancelled' THEN
        UPDATE email_flow_enrollments SET status = 'cancelled', exit_reason = 'redemption cancelled', next_run_at = NULL
         WHERE status = 'active' AND trigger_key IN ('redemption:' || NEW.id::TEXT, 'redemption_fulfilled:' || NEW.id::TEXT);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email flow enrollment from % failed: %', TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- A redemption rolled back by the portal (row deleted) cancels its emails.
CREATE OR REPLACE FUNCTION email_flow_redemption_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE email_flow_enrollments SET status = 'cancelled', exit_reason = 'redemption removed', next_run_at = NULL
   WHERE status = 'active' AND trigger_key IN ('redemption:' || OLD.id::TEXT, 'redemption_fulfilled:' || OLD.id::TEXT);
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email flow cancel failed: %', SQLERRM;
  RETURN OLD;
END;
$$;

CREATE TRIGGER email_consent_events_flow_enroll
  AFTER INSERT ON email_consent_events
  FOR EACH ROW EXECUTE FUNCTION email_flow_event_trigger();
CREATE TRIGGER loyalty_orders_flow_enroll
  AFTER INSERT ON loyalty_orders
  FOR EACH ROW EXECUTE FUNCTION email_flow_event_trigger();
CREATE TRIGGER loyalty_transactions_flow_enroll
  AFTER INSERT ON loyalty_transactions
  FOR EACH ROW EXECUTE FUNCTION email_flow_event_trigger();
CREATE TRIGGER loyalty_redemptions_flow_enroll
  AFTER INSERT OR UPDATE OF status ON loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION email_flow_event_trigger();
CREATE TRIGGER loyalty_redemptions_flow_cancel
  AFTER DELETE ON loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION email_flow_redemption_deleted();

-- Time-based triggers, run daily by the flow cron: lapsed customers, points
-- ready to redeem, birthdays. Returns how many enrolled per flow.
CREATE OR REPLACE FUNCTION email_flow_scan(p_today DATE DEFAULT (now() AT TIME ZONE 'America/New_York')::DATE)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_flow RECORD;
  v_days INTEGER;
  v_min INTEGER;
  v_every INTEGER;
  v_count INTEGER;
  v_result JSONB := '{}'::jsonb;
BEGIN
  FOR v_flow IN SELECT * FROM email_flows WHERE status = 'active' AND trigger IN ('order_lapsed', 'points_balance', 'birthday') LOOP
    v_count := 0;
    IF v_flow.trigger = 'order_lapsed' THEN
      v_days := coalesce((v_flow.trigger_config ->> 'days')::INTEGER, 60);
      SELECT count(*) INTO v_count FROM (
        SELECT email_flow_enroll(v_flow.slug, c.email,
                 'lapsed:' || c.id::TEXT || ':' || to_char(c.last_order_at, 'YYYY-MM-DD'),
                 jsonb_build_object('last_order_at', c.last_order_at, 'order_count', c.order_count)) AS id
          FROM email_contacts c
         WHERE c.last_order_at IS NOT NULL
           AND c.last_order_at < now() - make_interval(days => v_days)
      ) e WHERE e.id IS NOT NULL;

    ELSIF v_flow.trigger = 'points_balance' THEN
      v_min := coalesce((v_flow.trigger_config ->> 'min_points')::INTEGER, 5000);
      v_every := coalesce((v_flow.trigger_config ->> 'every_days')::INTEGER, 30);
      SELECT count(*) INTO v_count FROM (
        SELECT email_flow_enroll(v_flow.slug, m.email,
                 'points:' || m.id::TEXT || ':' || floor(extract(epoch FROM now()) / (v_every * 86400))::TEXT,
                 jsonb_build_object('member_id', m.id, 'points_balance', m.points_balance)) AS id
          FROM loyalty_members m
         WHERE m.points_balance >= v_min
           AND NOT EXISTS (
             SELECT 1 FROM loyalty_redemptions r
              WHERE r.member_id = m.id AND r.created_at > now() - make_interval(days => v_every))
      ) e WHERE e.id IS NOT NULL;

    ELSIF v_flow.trigger = 'birthday' THEN
      SELECT count(*) INTO v_count FROM (
        SELECT email_flow_enroll(v_flow.slug, c.email,
                 'birthday:' || c.id::TEXT || ':' || extract(year FROM p_today)::TEXT,
                 jsonb_build_object('birthday', to_char(p_today, 'Mon DD'))) AS id
          FROM email_contacts c
         WHERE c.birthday_month = extract(month FROM p_today)
           AND c.birthday_day = extract(day FROM p_today)
      ) e WHERE e.id IS NOT NULL;
    END IF;
    v_result := v_result || jsonb_build_object(v_flow.slug, v_count);
  END LOOP;
  RETURN v_result;
END;
$$;

-- Seed flows. All start as drafts; staff review the copy and activate.
INSERT INTO email_flows (slug, name, description, trigger, trigger_config, stream, list_slug, status, sender_id, sort_order) VALUES
  ('welcome', 'Welcome series', 'Starts the first time someone opts in to a consumer list.', 'list_opt_in', '{}', 'marketing', 'community', 'draft', 'loyalty', 10),
  ('post_purchase', 'After an order', 'Thank-you and share-your-moment ask, then a reorder reminder. Uses the order history; the reminder is skipped if they already reordered.', 'order_placed', '{}', 'marketing', 'community', 'draft', 'orders', 20),
  ('win_back', 'Win back lapsed customers', 'Customers with no order in 60 days. Stops as soon as they order.', 'order_lapsed', '{"days": 60}', 'marketing', 'offers', 'draft', 'loyalty', 30),
  ('referral_credit', 'Referral credit earned', 'A referral credited points: shows the new balance and how to redeem, then a reminder if they haven''t redeemed.', 'referral_credit', '{}', 'transactional', NULL, 'draft', 'loyalty', 40),
  ('points_reminder', 'Points ready to redeem', 'Members whose balance covers a reward and who haven''t redeemed in 30 days.', 'points_balance', '{"min_points": 5000, "every_days": 30}', 'transactional', NULL, 'draft', 'loyalty', 50),
  ('redemption_received', 'Redemption received', 'Confirms a reward redemption the moment it''s placed.', 'redemption_created', '{}', 'transactional', NULL, 'draft', 'loyalty', 60),
  ('redemption_fulfilled', 'Reward on its way', 'Sent when staff mark a redemption fulfilled.', 'redemption_fulfilled', '{}', 'transactional', NULL, 'draft', 'loyalty', 70),
  ('birthday', 'Birthday', 'On the birthday a subscriber saved in their email preferences.', 'birthday', '{}', 'marketing', 'offers', 'draft', 'loyalty', 80),
  ('cart_abandoned', 'Abandoned cart', 'Not available: the AccelPay cart doesn''t report carts or emails before checkout.', 'cart_abandoned', '{}', 'marketing', 'offers', 'unavailable', 'orders', 90);

INSERT INTO email_flow_steps (flow_slug, step_order, delay_hours, subject, preheader, blocks, list_slug, exit_if) VALUES
  ('welcome', 1, 0, 'Welcome to the pack, {{first_name|there}}', 'Here''s what you just signed up for.',
   '[{"type":"heading","text":"Welcome to the pack"},{"type":"text","text":"Hey {{first_name|there}},\n\nThanks for joining the Untamed list. You''ll be first to hear about new drinks, drops, and community news."},{"type":"button","label":"Meet the lineup","url":"{{site_url}}/drinks"}]',
   NULL, NULL),
  ('welcome', 2, 72, 'Four big cats, one pack', 'Find your favorite.',
   '[{"type":"heading","text":"Find your favorite"},{"type":"text","text":"Black Panther, Cheetah, Cougar, Lioness. Every one built for nights worth remembering."},{"type":"button","label":"Shop Untamed","url":"{{site_url}}/shop"}]',
   'new_drinks', NULL),
  ('post_purchase', 1, 72, 'How''s your Untamed, {{first_name|there}}?', 'Share your moment, earn points.',
   '[{"type":"heading","text":"Thanks for your order"},{"type":"text","text":"Hope you''re enjoying {{order_items|your order}}. Snap a photo or short clip of your Untamed moment and share it in your portal for points."},{"type":"button","label":"Share your moment","url":"{{portal_url}}/ugc/new"}]',
   NULL, NULL),
  ('post_purchase', 2, 432, 'Running low?', 'Restock your favorites.',
   '[{"type":"heading","text":"Ready for another round?"},{"type":"text","text":"It''s been a few weeks since your last order. Restock {{order_items|your favorites}} anytime."},{"type":"button","label":"Reorder","url":"{{site_url}}/shop"}]',
   'offers', 'ordered_since_enrollment'),
  ('win_back', 1, 0, 'We miss you, {{first_name|there}}', 'Come back to the pack.',
   '[{"type":"heading","text":"It''s been a while"},{"type":"text","text":"Your last Untamed order was a while back. Here''s what''s new since then."},{"type":"button","label":"See what''s new","url":"{{site_url}}/shop"}]',
   NULL, 'ordered_since_enrollment'),
  ('win_back', 2, 336, 'Still thinking it over?', 'Your favorites are waiting.',
   '[{"type":"text","text":"Hey {{first_name|there}}, your favorites are still here when you''re ready."},{"type":"button","label":"Shop Untamed","url":"{{site_url}}/shop"}]',
   NULL, 'ordered_since_enrollment'),
  ('referral_credit', 1, 0, 'You earned {{points}} points', 'Your referral paid off.',
   '[{"type":"heading","text":"Your referral paid off"},{"type":"text","text":"{{credit_reason}}. We added {{points}} points to your balance. You now have {{points_balance}} points."},{"type":"rewards"},{"type":"button","label":"Redeem your points","url":"{{portal_url}}/rewards"}]',
   NULL, NULL),
  ('referral_credit', 2, 168, 'Your {{points_balance}} points are ready', 'Turn your referral credit into gear.',
   '[{"type":"text","text":"You have {{points_balance}} points waiting. Here''s what they cover."},{"type":"rewards"},{"type":"button","label":"Redeem now","url":"{{portal_url}}/rewards"}]',
   NULL, 'redeemed_since_enrollment'),
  ('points_reminder', 1, 0, 'You have {{points_balance}} points to spend', 'Redeem for Untamed gear.',
   '[{"type":"heading","text":"Your points are ready"},{"type":"text","text":"You have {{points_balance}} points. Here''s what you can redeem today."},{"type":"rewards"},{"type":"button","label":"Redeem","url":"{{portal_url}}/rewards"}]',
   NULL, 'balance_below_min_reward'),
  ('redemption_received', 1, 0, 'We got your redemption: {{reward}}', 'Your reward is being prepared.',
   '[{"type":"heading","text":"Redemption received"},{"type":"text","text":"You redeemed {{points_cost}} points for {{reward}}. We''ll email you when it ships. Your balance is now {{points_balance}} points."},{"type":"button","label":"View your rewards","url":"{{portal_url}}/rewards"}]',
   NULL, NULL),
  ('redemption_fulfilled', 1, 0, 'Your {{reward}} is on its way', 'Thanks for being part of the pack.',
   '[{"type":"heading","text":"It''s on its way"},{"type":"text","text":"Your {{reward}} has been fulfilled. Thanks for being part of the pack."},{"type":"button","label":"Earn more points","url":"{{portal_url}}"}]',
   NULL, NULL),
  ('birthday', 1, 0, 'Happy birthday, {{first_name|there}}', 'A toast from the pack.',
   '[{"type":"heading","text":"Happy birthday"},{"type":"text","text":"Here''s to another year untamed. Celebrate responsibly."},{"type":"button","label":"Treat yourself","url":"{{site_url}}/shop"}]',
   NULL, NULL);

-- ============================================================================
-- 9. Reporting
-- ============================================================================

-- Per campaign / flow: sends, outcomes, unsubscribes, and attributed revenue
-- (an order within 7 days after a click, credited to the most recent click).
CREATE OR REPLACE FUNCTION email_send_stats(p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '90 days')
RETURNS TABLE (
  campaign_id UUID,
  flow_slug TEXT,
  sent INTEGER,
  delivered INTEGER,
  opened INTEGER,
  clicked INTEGER,
  bounced INTEGER,
  complaints INTEGER,
  unsubscribes INTEGER,
  orders INTEGER,
  revenue_cents BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH msgs AS (
    SELECT m.campaign_id, m.flow_slug, m.to_email, m.status, m.delivered_at, m.opened_at, m.clicked_at
      FROM email_messages m
     WHERE m.direction = 'outbound'
       AND m.sent_at >= p_since
       AND (m.campaign_id IS NOT NULL OR m.flow_slug IS NOT NULL)
  ),
  base AS (
    SELECT campaign_id, flow_slug,
           count(*)::INTEGER AS sent,
           count(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered', 'opened', 'clicked'))::INTEGER AS delivered,
           count(*) FILTER (WHERE opened_at IS NOT NULL)::INTEGER AS opened,
           count(*) FILTER (WHERE clicked_at IS NOT NULL)::INTEGER AS clicked,
           count(*) FILTER (WHERE status = 'bounced')::INTEGER AS bounced,
           count(*) FILTER (WHERE status = 'complaint')::INTEGER AS complaints
      FROM msgs
     GROUP BY campaign_id, flow_slug
  ),
  unsubs AS (
    SELECT e.campaign_id, count(DISTINCT e.contact_id)::INTEGER AS n
      FROM email_consent_events e
     WHERE e.action IN ('unsubscribe_all', 'opt_out') AND e.campaign_id IS NOT NULL AND e.created_at >= p_since
     GROUP BY e.campaign_id
  ),
  attributed AS (
    SELECT DISTINCT ON (o.id) o.id, o.total_cents, c.campaign_id, c.flow_slug
      FROM loyalty_orders o
      JOIN msgs c
        ON c.clicked_at IS NOT NULL
       AND c.to_email = lower(btrim(o.email))
       AND o.created_at >= c.clicked_at
       AND o.created_at < c.clicked_at + INTERVAL '7 days'
     ORDER BY o.id, c.clicked_at DESC
  ),
  revenue AS (
    SELECT campaign_id, flow_slug, count(*)::INTEGER AS orders, coalesce(sum(total_cents), 0)::BIGINT AS revenue_cents
      FROM attributed
     GROUP BY campaign_id, flow_slug
  )
  SELECT b.campaign_id, b.flow_slug, b.sent, b.delivered, b.opened, b.clicked, b.bounced, b.complaints,
         coalesce(u.n, 0), coalesce(r.orders, 0), coalesce(r.revenue_cents, 0)
    FROM base b
    LEFT JOIN unsubs u ON u.campaign_id = b.campaign_id
    LEFT JOIN revenue r ON r.campaign_id IS NOT DISTINCT FROM b.campaign_id AND r.flow_slug IS NOT DISTINCT FROM b.flow_slug
$$;

-- Deliverability over the last p_days for one stream.
CREATE OR REPLACE FUNCTION email_health(p_days INTEGER DEFAULT 30, p_stream TEXT DEFAULT 'marketing')
RETURNS TABLE (sent INTEGER, delivered INTEGER, bounced INTEGER, complaints INTEGER, opened INTEGER, clicked INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::INTEGER,
         count(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered', 'opened', 'clicked'))::INTEGER,
         count(*) FILTER (WHERE status = 'bounced')::INTEGER,
         count(*) FILTER (WHERE status = 'complaint')::INTEGER,
         count(*) FILTER (WHERE opened_at IS NOT NULL)::INTEGER,
         count(*) FILTER (WHERE clicked_at IS NOT NULL)::INTEGER
    FROM email_messages
   WHERE direction = 'outbound'
     AND stream = p_stream
     AND sent_at >= now() - make_interval(days => p_days)
$$;

-- Opt-ins and opt-outs per day.
CREATE OR REPLACE FUNCTION email_list_growth(p_days INTEGER DEFAULT 90)
RETURNS TABLE (day DATE, list_slug TEXT, opt_ins INTEGER, opt_outs INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (created_at AT TIME ZONE 'America/New_York')::DATE AS day,
         coalesce(list_slug, 'all') AS list_slug,
         count(*) FILTER (WHERE action = 'opt_in')::INTEGER,
         count(*) FILTER (WHERE action IN ('opt_out', 'unsubscribe_all', 'complaint'))::INTEGER
    FROM email_consent_events
   WHERE created_at >= now() - make_interval(days => p_days)
     AND action IN ('opt_in', 'opt_out', 'unsubscribe_all', 'complaint')
   GROUP BY 1, 2
   ORDER BY 1, 2
$$;

-- ============================================================================
-- 10. Phase 5: Gmail sync and one-to-one outreach
-- ============================================================================
CREATE TABLE gmail_sync_state (
  mailbox TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ,
  -- Newest message time already synced; the next run starts just before it.
  last_message_at TIMESTAMPTZ,
  last_error TEXT,
  messages_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages in the unsubscribe@ mailbox that were already handled.
CREATE TABLE email_mailbox_processed (
  mailbox TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mailbox, gmail_message_id)
);

CREATE TABLE outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- [{ "delay_days": 0, "subject": "...", "body": "..." }, ...]; steps after
  -- the first reply in the same thread.
  steps JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array'),
  daily_cap_per_sender INTEGER NOT NULL DEFAULT 40 CHECK (daily_cap_per_sender BETWEEN 1 AND 500),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER outreach_sequences_updated_at
  BEFORE UPDATE ON outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE outreach_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES email_contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sender_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replied', 'completed', 'stopped', 'bounced', 'suppressed')),
  next_step INTEGER NOT NULL DEFAULT 1,
  next_run_at TIMESTAMPTZ,
  gmail_thread_id TEXT,
  last_rfc_message_id TEXT,
  last_sent_at TIMESTAMPTZ,
  stopped_reason TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, email)
);
CREATE INDEX idx_outreach_enrollments_due ON outreach_enrollments(next_run_at) WHERE status = 'active';
CREATE TRIGGER outreach_enrollments_updated_at
  BEFORE UPDATE ON outreach_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 11. Phase 6: alerts and staff audit log
-- ============================================================================
CREATE TABLE email_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN (
    'complaint_rate', 'bounce_rate', 'worker_failure', 'flow_failure',
    'gmail_sync_failure', 'outreach_failure', 'marketing_paused', 'other'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Same dedupe key within a day = one alert.
  dedupe_key TEXT,
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_email_alerts_dedupe ON email_alerts(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_email_alerts_open ON email_alerts(created_at DESC) WHERE resolved_at IS NULL;

CREATE TABLE staff_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_audit_log_created ON staff_audit_log(created_at DESC);
CREATE INDEX idx_staff_audit_log_entity ON staff_audit_log(entity_type, entity_id);

-- Retention: clear old email bodies (keep who/when/status), drop old raw
-- webhook payloads and finished queue rows. Consent evidence is never purged.
CREATE OR REPLACE FUNCTION email_apply_retention(
  p_body_days INTEGER,
  p_webhook_days INTEGER DEFAULT 90,
  p_queue_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bodies INTEGER;
  v_webhooks INTEGER;
  v_queue INTEGER;
  v_signups INTEGER;
BEGIN
  UPDATE email_messages
     SET body_html = NULL, body_text = NULL
   WHERE sent_at < now() - make_interval(days => greatest(p_body_days, 30))
     AND (body_html IS NOT NULL OR body_text IS NOT NULL);
  GET DIAGNOSTICS v_bodies = ROW_COUNT;

  DELETE FROM email_webhook_events WHERE created_at < now() - make_interval(days => greatest(p_webhook_days, 7));
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;

  DELETE FROM scheduled_messages
   WHERE status IN ('sent', 'cancelled', 'failed')
     AND updated_at < now() - make_interval(days => greatest(p_queue_days, 7));
  GET DIAGNOSTICS v_queue = ROW_COUNT;

  DELETE FROM email_signup_requests WHERE status <> 'confirmed' AND expires_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_signups = ROW_COUNT;

  RETURN jsonb_build_object('bodies_cleared', v_bodies, 'webhook_events_deleted', v_webhooks,
                            'queue_rows_deleted', v_queue, 'signup_requests_deleted', v_signups);
END;
$$;

-- ============================================================================
-- 12. Data deletion covers the new tables too
-- ============================================================================
CREATE OR REPLACE FUNCTION email_delete_contact_data(
  p_contact_id UUID,
  p_actor_staff_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_messages INTEGER;
  v_queued INTEGER;
  v_webhooks INTEGER;
BEGIN
  SELECT email INTO v_email FROM email_contacts WHERE id = p_contact_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Contact not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM scheduled_messages
   WHERE email_contact_id = p_contact_id OR lower(recipient_email) = v_email;
  GET DIAGNOSTICS v_queued = ROW_COUNT;

  DELETE FROM email_messages
   WHERE email_contact_id = p_contact_id OR lower(to_email) = v_email OR lower(from_email) = v_email;
  GET DIAGNOSTICS v_messages = ROW_COUNT;

  DELETE FROM email_webhook_events WHERE lower(recipient_email) = v_email;
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;

  DELETE FROM email_flow_enrollments WHERE contact_id = p_contact_id OR email = v_email;
  DELETE FROM outreach_enrollments WHERE contact_id = p_contact_id OR email = v_email;
  DELETE FROM email_signup_requests WHERE email = v_email;
  DELETE FROM email_contacts WHERE id = p_contact_id;

  INSERT INTO email_suppressions (email, reason, notes)
  VALUES (v_email, 'data_deletion',
          left('Data deletion request' || coalesce(' by staff ' || p_actor_staff_id::TEXT, '') || coalesce(': ' || p_note, ''), 500))
  ON CONFLICT (email) DO UPDATE SET reason = 'data_deletion', notes = EXCLUDED.notes;

  RETURN jsonb_build_object(
    'email', v_email,
    'messages_deleted', v_messages,
    'queued_deleted', v_queued,
    'webhook_events_deleted', v_webhooks
  );
END;
$$;

-- ============================================================================
-- 13. Row level security and grants
-- ============================================================================
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_mailbox_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email settings" ON email_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read email templates" ON email_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read email flows" ON email_flows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read email flow steps" ON email_flow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read email alerts" ON email_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read outreach sequences" ON outreach_sequences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
-- Person-level records: not for limited contractors.
CREATE POLICY "Staff can read flow enrollments" ON email_flow_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true AND staff.role <> 'contractor_limited'));
CREATE POLICY "Staff can read outreach enrollments" ON outreach_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true AND staff.role <> 'contractor_limited'));
CREATE POLICY "Admins can read audit log" ON staff_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true AND staff.role IN ('super_admin', 'admin')));
-- email_signup_requests, gmail_sync_state, email_mailbox_processed: service role only.

REVOKE ALL ON TABLE email_settings, email_signup_requests, email_templates, email_flows, email_flow_steps,
  email_flow_enrollments, gmail_sync_state, email_mailbox_processed, outreach_sequences,
  outreach_enrollments, email_alerts, staff_audit_log
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE email_settings, email_templates, email_flows, email_flow_steps,
  email_flow_enrollments, outreach_sequences, outreach_enrollments, email_alerts, staff_audit_log
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE email_settings, email_signup_requests, email_templates,
  email_flows, email_flow_steps, email_flow_enrollments, gmail_sync_state, email_mailbox_processed,
  outreach_sequences, outreach_enrollments, email_alerts, staff_audit_log
  TO service_role;

REVOKE ALL ON FUNCTION
  email_zip_to_state(TEXT),
  email_refresh_order_stats(TEXT),
  email_order_stats_trigger(),
  email_message_engagement_trigger(),
  email_marketing_recipients(TEXT, TEXT[], TEXT[], INTEGER, INTEGER),
  email_recent_marketing_counts(TEXT[], TIMESTAMPTZ),
  email_flow_enroll(TEXT, TEXT, TEXT, JSONB),
  email_flow_event_trigger(),
  email_flow_redemption_deleted(),
  email_flow_scan(DATE),
  email_send_stats(TIMESTAMPTZ),
  email_health(INTEGER, TEXT),
  email_list_growth(INTEGER),
  email_apply_retention(INTEGER, INTEGER, INTEGER),
  email_delete_contact_data(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  email_zip_to_state(TEXT),
  email_refresh_order_stats(TEXT),
  email_marketing_recipients(TEXT, TEXT[], TEXT[], INTEGER, INTEGER),
  email_recent_marketing_counts(TEXT[], TIMESTAMPTZ),
  email_flow_enroll(TEXT, TEXT, TEXT, JSONB),
  email_flow_scan(DATE),
  email_send_stats(TIMESTAMPTZ),
  email_health(INTEGER, TEXT),
  email_list_growth(INTEGER),
  email_apply_retention(INTEGER, INTEGER, INTEGER),
  email_delete_contact_data(UUID, UUID, TEXT)
  TO service_role;

-- ============================================================================
-- 14. Backfill order history onto existing contacts
-- ============================================================================
SELECT email_refresh_order_stats(email) FROM (SELECT DISTINCT lower(btrim(email)) AS email FROM loyalty_orders) o;

NOTIFY pgrst, 'reload schema';

COMMIT;
