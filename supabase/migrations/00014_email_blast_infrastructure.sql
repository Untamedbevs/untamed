-- ============================================================================
-- Untamed Beverages - Email Blast Infrastructure (SES-backed)
-- Ports the Mosquito Curtains messaging system, adapted to Untamed's
-- audience model (loyalty_members, referral_participants, distributor_leads).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. messaging_campaigns -- one row per blast/campaign
-- ============================================================================
CREATE TABLE messaging_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  text_body TEXT,
  html_body TEXT,
  sender_id TEXT,
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'cancelled')),
  error_log TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messaging_campaigns_status ON messaging_campaigns(status);
CREATE INDEX idx_messaging_campaigns_created_at ON messaging_campaigns(created_at DESC);

CREATE TRIGGER messaging_campaigns_updated_at
  BEFORE UPDATE ON messaging_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. scheduled_messages -- per-recipient queue, drained by cron worker
-- ============================================================================
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type TEXT NOT NULL CHECK (message_type IN ('email', 'sms')),
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  subject TEXT,
  body TEXT,
  text_body TEXT,
  sender_email TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  loyalty_member_id UUID REFERENCES loyalty_members(id) ON DELETE SET NULL,
  referral_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  distributor_lead_id UUID REFERENCES distributor_leads(id) ON DELETE SET NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hot path: cron worker selects pending/processing
CREATE INDEX idx_scheduled_messages_pending
  ON scheduled_messages(status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_scheduled_messages_entity
  ON scheduled_messages(related_entity_type, related_entity_id);

CREATE INDEX idx_scheduled_messages_recipient_email
  ON scheduled_messages(recipient_email)
  WHERE recipient_email IS NOT NULL;

CREATE TRIGGER scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. email_messages -- log of every outbound + inbound email
-- Foundation for transactional history, threading, and (later) inbox UI.
-- ============================================================================
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES messaging_campaigns(id) ON DELETE SET NULL,
  loyalty_member_id UUID REFERENCES loyalty_members(id) ON DELETE SET NULL,
  referral_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  distributor_lead_id UUID REFERENCES distributor_leads(id) ON DELETE SET NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN (
      'sent', 'delivered', 'failed', 'bounced',
      'opened', 'clicked', 'complaint', 'received'
    )),
  ses_message_id TEXT,
  thread_id TEXT,
  template_slug TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachment_urls TEXT[],
  sent_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complaint_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_messages_campaign_id
  ON email_messages(campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX idx_email_messages_to_email ON email_messages(to_email);
CREATE INDEX idx_email_messages_ses_message_id
  ON email_messages(ses_message_id)
  WHERE ses_message_id IS NOT NULL;
CREATE INDEX idx_email_messages_thread_id
  ON email_messages(thread_id)
  WHERE thread_id IS NOT NULL;
CREATE INDEX idx_email_messages_sent_at ON email_messages(sent_at DESC);

-- ============================================================================
-- 4. email_suppressions -- bounce / complaint / manual suppression list
-- Enforced at queue time AND send time. Auto-populated by SNS webhook.
-- ============================================================================
CREATE TABLE email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual', 'unsubscribe')),
  source_message_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_suppressions_email ON email_suppressions(email);
CREATE INDEX idx_email_suppressions_reason ON email_suppressions(reason);

-- ============================================================================
-- 5. email_webhook_events -- raw SNS payload audit log
-- Useful for debugging and re-processing if webhook handler logic changes.
-- ============================================================================
CREATE TABLE email_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  ses_message_id TEXT,
  recipient_email TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_webhook_events_type ON email_webhook_events(event_type);
CREATE INDEX idx_email_webhook_events_ses_message_id
  ON email_webhook_events(ses_message_id)
  WHERE ses_message_id IS NOT NULL;
CREATE INDEX idx_email_webhook_events_created_at ON email_webhook_events(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- All access from app code uses the service-role client which bypasses RLS;
-- these policies guard against authenticated-client reads only.
-- ============================================================================
ALTER TABLE messaging_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read messaging campaigns"
  ON messaging_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read scheduled messages"
  ON scheduled_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read email messages"
  ON email_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read email suppressions"
  ON email_suppressions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read email webhook events"
  ON email_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

COMMIT;
