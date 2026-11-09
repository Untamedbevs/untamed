-- ============================================================================
-- Untamed Beverages - Email contacts, topic lists, and consent records
--
-- One contact row per email address, linked to every place that address
-- appears (loyalty, online orders, referrals, wholesale leads, creator
-- applications, contact form). Marketing email may only go to contacts with a
-- recorded opt-in for the list being sent, so every consent change is written
-- to an append-only evidence log (who, what wording, when, from where).
--
-- Requires 00014 (messaging tables), 00019 (loyalty_orders), 00020
-- (contact_submissions), and 00026 (influencer_leads).
--
-- All consent writes go through email_apply_consent() so the evidence row, the
-- current status, and the suppression list change together in one transaction.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. Helpers
-- ============================================================================

-- Lowercased, trimmed address, or NULL when it isn't a plausible email.
CREATE OR REPLACE FUNCTION email_normalize(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_email IS NULL THEN NULL
    WHEN lower(btrim(p_email)) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      THEN lower(btrim(p_email))
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION email_first_name(p_full_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(regexp_replace(btrim(coalesce(p_full_name, '')), '[[:space:]]+', ' ', 'g'), ' ', 1), '')
$$;

CREATE OR REPLACE FUNCTION email_last_name(p_full_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(btrim(substr(
    regexp_replace(btrim(coalesce(p_full_name, '')), '[[:space:]]+', ' ', 'g'),
    length(split_part(regexp_replace(btrim(coalesce(p_full_name, '')), '[[:space:]]+', ' ', 'g'), ' ', 1)) + 1
  )), '')
$$;

-- Higher rank wins when two suppression reasons collide on one address.
CREATE OR REPLACE FUNCTION email_suppression_rank(p_reason TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_reason
    WHEN 'data_deletion' THEN 5
    WHEN 'hard_bounce' THEN 4
    WHEN 'complaint' THEN 3
    WHEN 'manual' THEN 2
    WHEN 'unsubscribe' THEN 1
    ELSE 0
  END
$$;

-- ============================================================================
-- 1. email_lists -- the topics a person can subscribe to
-- ============================================================================
CREATE TABLE email_lists (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9_]+$'),
  name TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL CHECK (audience IN ('consumer', 'trade')),
  -- Consumer alcohol marketing goes only to contacts with a recorded 21+ attestation.
  requires_age_verification BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER email_lists_updated_at
  BEFORE UPDATE ON email_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO email_lists (slug, name, description, audience, requires_age_verification, sort_order) VALUES
  ('new_drinks', 'New drinks & drops', 'First word on new flavors, limited releases, and restocks.', 'consumer', true, 10),
  ('offers', 'Offers & promotions', 'Discounts, bundles, and shop promotions.', 'consumer', true, 20),
  ('community', 'Loyalty & community', 'Points events, rewards, community features, and news from the pack.', 'consumer', true, 30),
  ('trade', 'Trade & wholesale updates', 'Wholesale pricing, distribution news, and programs for bars, stores, and distributors.', 'trade', false, 40);

-- ============================================================================
-- 2. email_contacts -- one row per email address
-- ============================================================================
CREATE TABLE email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = email_normalize(email)),
  first_name TEXT,
  last_name TEXT,
  -- Most recent matching record in each source table.
  loyalty_member_id UUID REFERENCES loyalty_members(id) ON DELETE SET NULL,
  referral_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  distributor_lead_id UUID REFERENCES distributor_leads(id) ON DELETE SET NULL,
  influencer_lead_id UUID REFERENCES influencer_leads(id) ON DELETE SET NULL,
  -- Every place this address has appeared; first_source is the earliest.
  sources TEXT[] NOT NULL DEFAULT '{}' CHECK (
    sources <@ ARRAY['loyalty', 'order', 'referral', 'distributor', 'influencer', 'contact_form', 'consent', 'admin']::TEXT[]
  ),
  first_source TEXT,
  age_verified_at TIMESTAMPTZ,
  age_verification_method TEXT CHECK (
    age_verification_method IN ('self_attestation', 'influencer_application', 'checkout', 'admin')
  ),
  -- ISO 3166-1 alpha-2, from the request that recorded consent (best effort).
  country_code TEXT CHECK (country_code ~ '^[A-Z]{2}$'),
  -- The one-time permission request; never sent twice.
  repermission_sent_at TIMESTAMPTZ,
  repermission_campaign_id UUID REFERENCES messaging_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_contacts_loyalty_member_id ON email_contacts(loyalty_member_id) WHERE loyalty_member_id IS NOT NULL;
CREATE INDEX idx_email_contacts_referral_participant_id ON email_contacts(referral_participant_id) WHERE referral_participant_id IS NOT NULL;
CREATE INDEX idx_email_contacts_distributor_lead_id ON email_contacts(distributor_lead_id) WHERE distributor_lead_id IS NOT NULL;
CREATE INDEX idx_email_contacts_sources ON email_contacts USING gin(sources);
CREATE INDEX idx_email_contacts_created_at ON email_contacts(created_at DESC);

CREATE TRIGGER email_contacts_updated_at
  BEFORE UPDATE ON email_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. email_consents -- current status per contact per list
-- ============================================================================
CREATE TABLE email_consents (
  contact_id UUID NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  list_slug TEXT NOT NULL REFERENCES email_lists(slug) ON UPDATE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('subscribed', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  last_event_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, list_slug)
);

CREATE INDEX idx_email_consents_list_status ON email_consents(list_slug, status);

-- ============================================================================
-- 4. email_consent_events -- append-only evidence log
-- Rows are never edited. They are deleted only with their contact
-- (a data-deletion request), which leaves a 'data_deletion' suppression behind.
-- ============================================================================
CREATE TABLE email_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  -- NULL means the action applied to every list (unsubscribe-all, complaint, bounce).
  list_slug TEXT REFERENCES email_lists(slug) ON UPDATE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'opt_in', 'opt_out', 'unsubscribe_all', 'complaint', 'hard_bounce', 'age_verified'
  )),
  source TEXT NOT NULL CHECK (source IN (
    'repermission_email', 'signup_form', 'checkout', 'preference_page',
    'unsubscribe_link', 'one_click', 'mailto', 'ses_feedback', 'admin', 'import'
  )),
  source_detail TEXT,
  -- Exact wording the person agreed to, and its version.
  consent_text TEXT,
  consent_text_version TEXT,
  campaign_id UUID REFERENCES messaging_campaigns(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  country_code TEXT,
  actor_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  evidence_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_consent_events_contact ON email_consent_events(contact_id, created_at DESC);
CREATE INDEX idx_email_consent_events_action ON email_consent_events(action, created_at DESC);

-- Evidence columns are immutable. Foreign-key housekeeping (a deleted campaign
-- or staff row, a renamed list) is the only permitted change.
CREATE OR REPLACE FUNCTION email_consent_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.action IS DISTINCT FROM OLD.action
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.source_detail IS DISTINCT FROM OLD.source_detail
    OR NEW.consent_text IS DISTINCT FROM OLD.consent_text
    OR NEW.consent_text_version IS DISTINCT FROM OLD.consent_text_version
    OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
    OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
    OR NEW.country_code IS DISTINCT FROM OLD.country_code
    OR NEW.evidence_note IS DISTINCT FROM OLD.evidence_note
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (NEW.campaign_id IS NOT NULL AND NEW.campaign_id IS DISTINCT FROM OLD.campaign_id)
    OR (NEW.actor_staff_id IS NOT NULL AND NEW.actor_staff_id IS DISTINCT FROM OLD.actor_staff_id)
  THEN
    RAISE EXCEPTION 'email_consent_events rows are append-only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER email_consent_events_no_edit
  BEFORE UPDATE ON email_consent_events
  FOR EACH ROW EXECUTE FUNCTION email_consent_events_immutable();

-- ============================================================================
-- 5. Changes to the 00014 messaging tables
-- ============================================================================

-- Suppressions: record data-deletion requests and match case-insensitively.
ALTER TABLE email_suppressions DROP CONSTRAINT IF EXISTS email_suppressions_reason_check;
ALTER TABLE email_suppressions ADD CONSTRAINT email_suppressions_reason_check
  CHECK (reason IN ('hard_bounce', 'complaint', 'manual', 'unsubscribe', 'data_deletion'));
CREATE INDEX IF NOT EXISTS idx_email_suppressions_email_lower ON email_suppressions(lower(email));

-- Campaigns: which list a send is for, and whether it's the one-time permission request.
ALTER TABLE messaging_campaigns
  ADD COLUMN list_slug TEXT REFERENCES email_lists(slug) ON UPDATE CASCADE,
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'marketing' CHECK (kind IN ('marketing', 'repermission')),
  ADD COLUMN repermission_audience TEXT CHECK (repermission_audience IN ('consumer', 'trade')),
  ADD COLUMN copy_version TEXT,
  ADD COLUMN skipped_count INTEGER NOT NULL DEFAULT 0;

-- Queue rows carry the contact so a deletion request cancels pending sends.
ALTER TABLE scheduled_messages
  ADD COLUMN email_contact_id UUID REFERENCES email_contacts(id) ON DELETE CASCADE;
CREATE INDEX idx_scheduled_messages_contact ON scheduled_messages(email_contact_id) WHERE email_contact_id IS NOT NULL;

-- Message log: stream, transport, and engagement detail from SES events.
ALTER TABLE email_messages
  ADD COLUMN email_contact_id UUID REFERENCES email_contacts(id) ON DELETE SET NULL,
  ADD COLUMN stream TEXT CHECK (stream IN ('marketing', 'transactional')),
  ADD COLUMN transport TEXT CHECK (transport IN ('smtp', 'ses')),
  ADD COLUMN bounce_type TEXT,
  ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_event_at TIMESTAMPTZ;

ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_status_check;
ALTER TABLE email_messages ADD CONSTRAINT email_messages_status_check
  CHECK (status IN (
    'sent', 'delivered', 'failed', 'bounced', 'rejected',
    'opened', 'clicked', 'complaint', 'received'
  ));

-- Webhook matching and campaign dedupe compare lowercase addresses.
UPDATE email_messages SET to_email = lower(btrim(to_email)) WHERE to_email <> lower(btrim(to_email));

CREATE INDEX idx_email_messages_contact ON email_messages(email_contact_id, sent_at DESC) WHERE email_contact_id IS NOT NULL;
CREATE INDEX idx_email_messages_stream_sent_at ON email_messages(stream, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_campaign_to ON email_messages(campaign_id, to_email) WHERE campaign_id IS NOT NULL;

-- Webhook events: SNS retries the same notification, so dedupe on its id.
ALTER TABLE email_webhook_events ADD COLUMN sns_message_id TEXT;
CREATE UNIQUE INDEX idx_email_webhook_events_sns_message_id
  ON email_webhook_events(sns_message_id) WHERE sns_message_id IS NOT NULL;

-- ============================================================================
-- 6. Contact merge + source sync
-- ============================================================================

-- Create or update the contact for an address and return its id (NULL for an
-- invalid address). Later records refresh the source links; names and the
-- first source are kept from the earliest record.
CREATE OR REPLACE FUNCTION email_merge_contact(
  p_email TEXT,
  p_source TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_seen_at TIMESTAMPTZ DEFAULT NULL,
  p_loyalty_member_id UUID DEFAULT NULL,
  p_referral_participant_id UUID DEFAULT NULL,
  p_distributor_lead_id UUID DEFAULT NULL,
  p_influencer_lead_id UUID DEFAULT NULL,
  p_age_verification_method TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email TEXT := email_normalize(p_email);
  v_seen TIMESTAMPTZ := coalesce(p_seen_at, now());
  v_id UUID;
BEGIN
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO email_contacts AS c (
    email, first_name, last_name, sources, first_source,
    loyalty_member_id, referral_participant_id, distributor_lead_id, influencer_lead_id,
    age_verified_at, age_verification_method, created_at
  ) VALUES (
    v_email,
    NULLIF(btrim(p_first_name), ''),
    NULLIF(btrim(p_last_name), ''),
    CASE WHEN p_source IS NULL THEN '{}'::TEXT[] ELSE ARRAY[p_source] END,
    p_source,
    p_loyalty_member_id, p_referral_participant_id, p_distributor_lead_id, p_influencer_lead_id,
    CASE WHEN p_age_verification_method IS NOT NULL THEN v_seen END,
    p_age_verification_method,
    v_seen
  )
  ON CONFLICT (email) DO UPDATE SET
    first_name = coalesce(c.first_name, EXCLUDED.first_name),
    last_name = coalesce(c.last_name, EXCLUDED.last_name),
    sources = CASE
      WHEN p_source IS NULL OR p_source = ANY(c.sources) THEN c.sources
      ELSE array_append(c.sources, p_source)
    END,
    first_source = CASE
      WHEN c.first_source IS NULL OR EXCLUDED.created_at < c.created_at THEN coalesce(EXCLUDED.first_source, c.first_source)
      ELSE c.first_source
    END,
    loyalty_member_id = coalesce(EXCLUDED.loyalty_member_id, c.loyalty_member_id),
    referral_participant_id = coalesce(EXCLUDED.referral_participant_id, c.referral_participant_id),
    distributor_lead_id = coalesce(EXCLUDED.distributor_lead_id, c.distributor_lead_id),
    influencer_lead_id = coalesce(EXCLUDED.influencer_lead_id, c.influencer_lead_id),
    age_verification_method = CASE
      WHEN c.age_verified_at IS NULL THEN EXCLUDED.age_verification_method
      ELSE c.age_verification_method
    END,
    age_verified_at = coalesce(c.age_verified_at, EXCLUDED.age_verified_at),
    created_at = least(c.created_at, EXCLUDED.created_at)
  RETURNING c.id INTO v_id;

  RETURN v_id;
END;
$$;

-- Keeps email_contacts current whenever an address is added anywhere. Runs as
-- the table owner so inserts from any role sync, and never blocks the source
-- write: a sync failure is logged as a warning instead.
CREATE OR REPLACE FUNCTION email_sync_contact_from_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'loyalty_members' THEN
      PERFORM email_merge_contact(NEW.email, 'loyalty', NEW.first_name, NULL, NEW.created_at,
        p_loyalty_member_id => NEW.id);
    ELSIF TG_TABLE_NAME = 'loyalty_orders' THEN
      PERFORM email_merge_contact(NEW.email, 'order', NULL, NULL, NEW.created_at);
    ELSIF TG_TABLE_NAME = 'referral_participants' THEN
      PERFORM email_merge_contact(NEW.email, 'referral',
        email_first_name(NEW.display_name), email_last_name(NEW.display_name), NEW.created_at,
        p_referral_participant_id => NEW.id);
    ELSIF TG_TABLE_NAME = 'distributor_leads' THEN
      PERFORM email_merge_contact(NEW.email, 'distributor',
        email_first_name(NEW.contact_name), email_last_name(NEW.contact_name), NEW.created_at,
        p_distributor_lead_id => NEW.id);
    ELSIF TG_TABLE_NAME = 'influencer_leads' THEN
      PERFORM email_merge_contact(NEW.email, 'influencer',
        email_first_name(NEW.name), email_last_name(NEW.name), NEW.created_at,
        p_influencer_lead_id => NEW.id,
        p_age_verification_method => CASE WHEN NEW.is_21 THEN 'influencer_application' END);
    ELSIF TG_TABLE_NAME = 'contact_submissions' THEN
      PERFORM email_merge_contact(NEW.email, 'contact_form',
        email_first_name(NEW.name), email_last_name(NEW.name), NEW.created_at);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'email contact sync from % failed: %', TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER loyalty_members_email_contact_sync
  AFTER INSERT OR UPDATE OF email, first_name ON loyalty_members
  FOR EACH ROW EXECUTE FUNCTION email_sync_contact_from_source();

CREATE TRIGGER loyalty_orders_email_contact_sync
  AFTER INSERT OR UPDATE OF email ON loyalty_orders
  FOR EACH ROW EXECUTE FUNCTION email_sync_contact_from_source();

CREATE TRIGGER referral_participants_email_contact_sync
  AFTER INSERT OR UPDATE OF email, display_name ON referral_participants
  FOR EACH ROW EXECUTE FUNCTION email_sync_contact_from_source();

CREATE TRIGGER distributor_leads_email_contact_sync
  AFTER INSERT OR UPDATE OF email, contact_name ON distributor_leads
  FOR EACH ROW EXECUTE FUNCTION email_sync_contact_from_source();

CREATE TRIGGER influencer_leads_email_contact_sync
  AFTER INSERT OR UPDATE OF email, name, is_21 ON influencer_leads
  FOR EACH ROW EXECUTE FUNCTION email_sync_contact_from_source();

CREATE TRIGGER contact_submissions_email_contact_sync
  AFTER INSERT OR UPDATE OF email, name ON contact_submissions
  FOR EACH ROW EXECUTE FUNCTION email_sync_contact_from_source();

-- Rebuild contacts from every source table, oldest record first. Safe to
-- re-run; it never creates or changes consent.
CREATE OR REPLACE FUNCTION email_backfill_contacts()
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_rows INTEGER := 0;
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  SELECT count(*) INTO v_before FROM email_contacts;

  FOR r IN
    SELECT * FROM (
      SELECT email, 'loyalty' AS source, first_name, NULL::TEXT AS last_name, created_at,
             id AS loyalty_member_id, NULL::UUID AS referral_participant_id,
             NULL::UUID AS distributor_lead_id, NULL::UUID AS influencer_lead_id, NULL::TEXT AS age_method
        FROM loyalty_members
      UNION ALL
      SELECT email, 'order', NULL, NULL, created_at, NULL, NULL, NULL, NULL, NULL
        FROM loyalty_orders
      UNION ALL
      SELECT email, 'referral', email_first_name(display_name), email_last_name(display_name), created_at,
             NULL, id, NULL, NULL, NULL
        FROM referral_participants
      UNION ALL
      SELECT email, 'distributor', email_first_name(contact_name), email_last_name(contact_name), created_at,
             NULL, NULL, id, NULL, NULL
        FROM distributor_leads
      UNION ALL
      SELECT email, 'influencer', email_first_name(name), email_last_name(name), created_at,
             NULL, NULL, NULL, id, CASE WHEN is_21 THEN 'influencer_application' END
        FROM influencer_leads
      UNION ALL
      SELECT email, 'contact_form', email_first_name(name), email_last_name(name), created_at,
             NULL, NULL, NULL, NULL, NULL
        FROM contact_submissions
    ) s
    WHERE email_normalize(s.email) IS NOT NULL
    ORDER BY s.created_at NULLS FIRST
  LOOP
    PERFORM email_merge_contact(
      r.email, r.source, r.first_name, r.last_name, r.created_at,
      r.loyalty_member_id, r.referral_participant_id, r.distributor_lead_id, r.influencer_lead_id,
      r.age_method
    );
    v_rows := v_rows + 1;
  END LOOP;

  -- Attach existing message history to contacts.
  UPDATE email_messages m
     SET email_contact_id = c.id
    FROM email_contacts c
   WHERE m.email_contact_id IS NULL
     AND c.email = m.to_email;

  SELECT count(*) INTO v_after FROM email_contacts;

  RETURN jsonb_build_object(
    'source_rows', v_rows,
    'contacts_before', v_before,
    'contacts_after', v_after
  );
END;
$$;

-- ============================================================================
-- 7. Consent changes (the only way consent is written)
-- ============================================================================
CREATE OR REPLACE FUNCTION email_apply_consent(
  p_email TEXT,
  p_action TEXT,
  p_source TEXT,
  p_list_slugs TEXT[] DEFAULT NULL,
  p_source_detail TEXT DEFAULT NULL,
  p_consent_text TEXT DEFAULT NULL,
  p_consent_text_version TEXT DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_actor_staff_id UUID DEFAULT NULL,
  p_evidence_note TEXT DEFAULT NULL,
  p_age_attested BOOLEAN DEFAULT false,
  p_age_text TEXT DEFAULT NULL,
  p_source_message_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email TEXT := email_normalize(p_email);
  v_country TEXT := CASE WHEN upper(btrim(coalesce(p_country_code, ''))) ~ '^[A-Z]{2}$'
                         THEN upper(btrim(p_country_code)) END;
  v_user_agent TEXT := left(p_user_agent, 1000);
  v_contact UUID;
  v_lists TEXT[];
  v_slug TEXT;
  v_event UUID;
  v_reason TEXT;
  v_changed INTEGER := 0;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Invalid email address' USING ERRCODE = '22023';
  END IF;

  IF p_action NOT IN ('opt_in', 'opt_out', 'unsubscribe_all', 'complaint', 'hard_bounce') THEN
    RAISE EXCEPTION 'Unknown consent action: %', p_action USING ERRCODE = '22023';
  END IF;

  IF p_action IN ('opt_in', 'opt_out') THEN
    IF p_list_slugs IS NULL OR cardinality(p_list_slugs) = 0 THEN
      RAISE EXCEPTION '% requires at least one list', p_action USING ERRCODE = '22023';
    END IF;

    SELECT array_agg(DISTINCT slug ORDER BY slug) INTO v_lists
      FROM email_lists
     WHERE slug = ANY(p_list_slugs)
       AND (is_active OR p_action = 'opt_out');

    IF v_lists IS NULL OR cardinality(v_lists) <> (SELECT count(DISTINCT x) FROM unnest(p_list_slugs) x) THEN
      RAISE EXCEPTION 'Unknown or inactive list in %', p_list_slugs USING ERRCODE = '22023';
    END IF;
  END IF;

  -- An opt-in is only as good as its evidence.
  IF p_action = 'opt_in' THEN
    IF p_source = 'admin' THEN
      IF p_actor_staff_id IS NULL OR coalesce(btrim(p_evidence_note), '') = '' THEN
        RAISE EXCEPTION 'Staff-recorded opt-in needs the staff member and an evidence note' USING ERRCODE = '22023';
      END IF;
    ELSIF coalesce(btrim(p_consent_text), '') = '' OR coalesce(btrim(p_consent_text_version), '') = '' THEN
      RAISE EXCEPTION 'Opt-in needs the exact consent wording and its version' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_contact := email_merge_contact(v_email, CASE WHEN p_source = 'admin' THEN 'admin' ELSE 'consent' END);

  IF v_country IS NOT NULL THEN
    UPDATE email_contacts SET country_code = v_country WHERE id = v_contact AND country_code IS DISTINCT FROM v_country;
  END IF;

  IF p_age_attested THEN
    UPDATE email_contacts
       SET age_verified_at = coalesce(age_verified_at, now()),
           age_verification_method = coalesce(age_verification_method,
             CASE WHEN p_source = 'admin' THEN 'admin' ELSE 'self_attestation' END)
     WHERE id = v_contact;

    INSERT INTO email_consent_events (
      contact_id, email, list_slug, action, source, source_detail, consent_text,
      consent_text_version, campaign_id, ip_address, user_agent, country_code,
      actor_staff_id, evidence_note
    ) VALUES (
      v_contact, v_email, NULL, 'age_verified', p_source, p_source_detail, p_age_text,
      p_consent_text_version, p_campaign_id, p_ip_address, v_user_agent, v_country,
      p_actor_staff_id, p_evidence_note
    );
  END IF;

  IF p_action IN ('opt_in', 'opt_out') THEN
    FOREACH v_slug IN ARRAY v_lists LOOP
      INSERT INTO email_consent_events (
        contact_id, email, list_slug, action, source, source_detail, consent_text,
        consent_text_version, campaign_id, ip_address, user_agent, country_code,
        actor_staff_id, evidence_note
      ) VALUES (
        v_contact, v_email, v_slug, p_action, p_source, p_source_detail, p_consent_text,
        p_consent_text_version, p_campaign_id, p_ip_address, v_user_agent, v_country,
        p_actor_staff_id, p_evidence_note
      ) RETURNING id INTO v_event;

      INSERT INTO email_consents (contact_id, list_slug, status, subscribed_at, unsubscribed_at, last_event_id, updated_at)
      VALUES (
        v_contact, v_slug,
        CASE WHEN p_action = 'opt_in' THEN 'subscribed' ELSE 'unsubscribed' END,
        CASE WHEN p_action = 'opt_in' THEN now() END,
        CASE WHEN p_action = 'opt_out' THEN now() END,
        v_event, now()
      )
      ON CONFLICT (contact_id, list_slug) DO UPDATE SET
        status = EXCLUDED.status,
        subscribed_at = CASE WHEN EXCLUDED.status = 'subscribed' THEN now() ELSE email_consents.subscribed_at END,
        unsubscribed_at = CASE WHEN EXCLUDED.status = 'unsubscribed' THEN now() ELSE NULL END,
        last_event_id = EXCLUDED.last_event_id,
        updated_at = now();
      v_changed := v_changed + 1;
    END LOOP;

    -- A fresh opt-in lifts an earlier unsubscribe-all, but never a bounce,
    -- complaint, manual block, or deletion request.
    IF p_action = 'opt_in' THEN
      DELETE FROM email_suppressions WHERE lower(email) = v_email AND reason = 'unsubscribe';
    END IF;
  ELSE
    INSERT INTO email_consent_events (
      contact_id, email, list_slug, action, source, source_detail, consent_text,
      consent_text_version, campaign_id, ip_address, user_agent, country_code,
      actor_staff_id, evidence_note
    ) VALUES (
      v_contact, v_email, NULL, p_action, p_source, p_source_detail, p_consent_text,
      p_consent_text_version, p_campaign_id, p_ip_address, v_user_agent, v_country,
      p_actor_staff_id, p_evidence_note
    ) RETURNING id INTO v_event;

    IF p_action IN ('unsubscribe_all', 'complaint') THEN
      UPDATE email_consents
         SET status = 'unsubscribed', unsubscribed_at = now(), last_event_id = v_event, updated_at = now()
       WHERE contact_id = v_contact AND status <> 'unsubscribed';
      GET DIAGNOSTICS v_changed = ROW_COUNT;
    END IF;

    v_reason := CASE p_action
      WHEN 'unsubscribe_all' THEN 'unsubscribe'
      WHEN 'complaint' THEN 'complaint'
      ELSE 'hard_bounce'
    END;

    INSERT INTO email_suppressions (email, reason, source_message_id, notes)
    VALUES (v_email, v_reason, p_source_message_id, left(coalesce(p_evidence_note, p_source_detail), 500))
    ON CONFLICT (email) DO UPDATE SET
      reason = EXCLUDED.reason,
      source_message_id = coalesce(EXCLUDED.source_message_id, email_suppressions.source_message_id),
      notes = coalesce(EXCLUDED.notes, email_suppressions.notes)
    WHERE email_suppression_rank(EXCLUDED.reason) > email_suppression_rank(email_suppressions.reason);
  END IF;

  RETURN jsonb_build_object(
    'contact_id', v_contact,
    'email', v_email,
    'action', p_action,
    'lists', to_jsonb(coalesce(v_lists, '{}'::TEXT[])),
    'changed', v_changed
  );
END;
$$;

-- ============================================================================
-- 8. Recipient selection (used when queueing AND again right before sending)
-- ============================================================================

-- Contacts who may receive marketing on a list: subscribed, 21+ where the list
-- requires it, in an allowed country (unknown counts as allowed), and not
-- suppressed. p_emails optionally narrows to an audience-filter result.
CREATE OR REPLACE FUNCTION email_marketing_recipients(
  p_list_slug TEXT,
  p_allowed_countries TEXT[] DEFAULT ARRAY['US'],
  p_emails TEXT[] DEFAULT NULL
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
     AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE lower(s.email) = c.email)
     AND (p_emails IS NULL OR c.email = ANY(p_emails))
   ORDER BY c.created_at, c.id
$$;

-- Contacts eligible for the one-time permission request: never asked before,
-- never expressed a preference, not suppressed, and found in one of p_sources.
CREATE OR REPLACE FUNCTION email_repermission_recipients(
  p_sources TEXT[],
  p_allowed_countries TEXT[] DEFAULT ARRAY['US'],
  p_emails TEXT[] DEFAULT NULL
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
   WHERE c.repermission_sent_at IS NULL
     AND c.sources && p_sources
     AND (c.country_code IS NULL OR p_allowed_countries IS NULL OR c.country_code = ANY(p_allowed_countries))
     AND NOT EXISTS (
       SELECT 1 FROM email_consent_events e
        WHERE e.contact_id = c.id
          AND e.action IN ('opt_in', 'opt_out', 'unsubscribe_all', 'complaint', 'hard_bounce')
     )
     AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE lower(s.email) = c.email)
     AND (p_emails IS NULL OR c.email = ANY(p_emails))
   ORDER BY c.created_at, c.id
$$;

-- ============================================================================
-- 9. Delivery / engagement events from SES, applied in one atomic update.
-- p_event: delivery | open | click | bounce_permanent | bounce_transient |
--          complaint | reject. Status only moves forward
-- (sent -> delivered -> opened -> clicked); bounce/reject/complaint stick.
-- ============================================================================
CREATE OR REPLACE FUNCTION email_apply_delivery_event(
  p_ses_message_id TEXT,
  p_recipient TEXT,
  p_event TEXT,
  p_at TIMESTAMPTZ DEFAULT now(),
  p_bounce_type TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_at TIMESTAMPTZ := coalesce(p_at, now());
  v_count INTEGER;
BEGIN
  IF p_event NOT IN ('delivery', 'open', 'click', 'bounce_permanent', 'bounce_transient', 'complaint', 'reject') THEN
    RAISE EXCEPTION 'Unknown delivery event: %', p_event USING ERRCODE = '22023';
  END IF;

  UPDATE email_messages m SET
    status = CASE
      WHEN p_event = 'complaint' THEN 'complaint'
      WHEN m.status = 'complaint' THEN m.status
      WHEN p_event = 'bounce_permanent' THEN 'bounced'
      WHEN p_event = 'reject' THEN 'rejected'
      WHEN m.status IN ('bounced', 'rejected', 'failed') THEN m.status
      WHEN p_event = 'click' THEN 'clicked'
      WHEN p_event = 'open' AND m.status IN ('sent', 'delivered') THEN 'opened'
      WHEN p_event = 'delivery' AND m.status = 'sent' THEN 'delivered'
      ELSE m.status
    END,
    delivered_at = CASE WHEN p_event = 'delivery' THEN coalesce(m.delivered_at, v_at) ELSE m.delivered_at END,
    opened_at = CASE WHEN p_event = 'open' THEN coalesce(m.opened_at, v_at) ELSE m.opened_at END,
    clicked_at = CASE WHEN p_event = 'click' THEN coalesce(m.clicked_at, v_at) ELSE m.clicked_at END,
    bounced_at = CASE WHEN p_event = 'bounce_permanent' THEN coalesce(m.bounced_at, v_at) ELSE m.bounced_at END,
    complaint_at = CASE WHEN p_event = 'complaint' THEN coalesce(m.complaint_at, v_at) ELSE m.complaint_at END,
    bounce_type = CASE WHEN p_event LIKE 'bounce_%' THEN coalesce(p_bounce_type, m.bounce_type) ELSE m.bounce_type END,
    open_count = m.open_count + CASE WHEN p_event = 'open' THEN 1 ELSE 0 END,
    click_count = m.click_count + CASE WHEN p_event = 'click' THEN 1 ELSE 0 END,
    last_event_at = greatest(coalesce(m.last_event_at, v_at), v_at)
  WHERE m.ses_message_id = p_ses_message_id
    AND (p_recipient IS NULL OR m.to_email = lower(btrim(p_recipient)));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 10. Data-deletion request
-- Removes the person's email-system data (contact, consent history, message
-- log, queued sends, raw webhook payloads) and leaves a suppression so the
-- address is never mailed again. Loyalty, order, and lead records are separate
-- business records and are not touched here.
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

  DELETE FROM email_messages WHERE email_contact_id = p_contact_id OR lower(to_email) = v_email;
  GET DIAGNOSTICS v_messages = ROW_COUNT;

  DELETE FROM email_webhook_events WHERE lower(recipient_email) = v_email;
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;

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
-- 11. Row level security and grants
-- App code uses the service-role client. Staff can read through the Data API;
-- limited contractors can't see contact or consent records.
-- ============================================================================
ALTER TABLE email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email lists"
  ON email_lists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read email contacts"
  ON email_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

CREATE POLICY "Staff can read email consents"
  ON email_consents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

CREATE POLICY "Staff can read email consent events"
  ON email_consent_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

REVOKE ALL ON TABLE email_lists, email_contacts, email_consents, email_consent_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE email_lists, email_contacts, email_consents, email_consent_events
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE email_lists, email_contacts, email_consents, email_consent_events
  TO service_role;

REVOKE ALL ON FUNCTION
  email_merge_contact(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT),
  email_sync_contact_from_source(),
  email_backfill_contacts(),
  email_apply_consent(TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, UUID, INET, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, TEXT),
  email_marketing_recipients(TEXT, TEXT[], TEXT[]),
  email_repermission_recipients(TEXT[], TEXT[], TEXT[]),
  email_apply_delivery_event(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT),
  email_delete_contact_data(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  email_merge_contact(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT),
  email_backfill_contacts(),
  email_apply_consent(TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, UUID, INET, TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT, TEXT),
  email_marketing_recipients(TEXT, TEXT[], TEXT[]),
  email_repermission_recipients(TEXT[], TEXT[], TEXT[]),
  email_apply_delivery_event(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT),
  email_delete_contact_data(UUID, UUID, TEXT)
  TO service_role;

-- ============================================================================
-- 12. Build contacts from existing records (no consent is created)
-- ============================================================================
SELECT email_backfill_contacts();

NOTIFY pgrst, 'reload schema';

COMMIT;
