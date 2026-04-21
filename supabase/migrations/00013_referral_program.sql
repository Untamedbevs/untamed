-- ============================================
-- Untamed Beverages - Referral Program
-- Dual-track: Consumer referrals + Distributor leads
-- ============================================

-- ============================================================================
-- REFERRAL PARTICIPANTS
-- Loyalty members enrolled in the referral program.
-- Linked to loyalty_members; enrollment auto-creates loyalty if needed.
-- ============================================================================
CREATE TABLE referral_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  display_name TEXT,
  referred_by_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  total_clicks INTEGER DEFAULT 0,
  consumer_signups INTEGER DEFAULT 0,
  distributor_leads INTEGER DEFAULT 0,
  paid_conversions INTEGER DEFAULT 0,
  custom_message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referral_participants_code ON referral_participants(referral_code);
CREATE INDEX idx_referral_participants_email ON referral_participants(email);
CREATE INDEX idx_referral_participants_loyalty_member ON referral_participants(loyalty_member_id);
CREATE INDEX idx_referral_participants_referred_by ON referral_participants(referred_by_participant_id)
  WHERE referred_by_participant_id IS NOT NULL;

-- ============================================================================
-- REFERRAL CODE HISTORY (old codes still resolve)
-- ============================================================================
CREATE TABLE referral_code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  old_code TEXT UNIQUE NOT NULL,
  replaced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referral_code_history_code ON referral_code_history(old_code);

-- ============================================================================
-- REFERRAL EVENTS
-- ============================================================================
CREATE TABLE referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'click_consumer', 'click_distributor',
    'consumer_signup', 'distributor_lead',
    'paid_conversion', 'referral_sent'
  )),
  referred_email TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referral_events_participant ON referral_events(participant_id);
CREATE INDEX idx_referral_events_type ON referral_events(event_type);
CREATE INDEX idx_referral_events_referred_email ON referral_events(referred_email)
  WHERE referred_email IS NOT NULL;

-- ============================================================================
-- REFERRAL REWARD TIERS
-- ============================================================================
CREATE TABLE referral_reward_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  tier_order INTEGER NOT NULL,
  min_consumer_signups INTEGER DEFAULT 0,
  min_distributor_leads INTEGER DEFAULT 0,
  min_paid_conversions INTEGER DEFAULT 0,
  reward_type TEXT NOT NULL CHECK (reward_type IN (
    'points', 'free_product', 'discount', 'merch', 'custom'
  )),
  reward_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referral_reward_tiers_order ON referral_reward_tiers(tier_order) WHERE is_active;

-- ============================================================================
-- REFERRAL REWARDS EARNED
-- ============================================================================
CREATE TABLE referral_rewards_earned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES referral_reward_tiers(id) ON DELETE CASCADE,
  is_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  earned_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referral_rewards_participant ON referral_rewards_earned(participant_id);
CREATE INDEX idx_referral_rewards_unclaimed ON referral_rewards_earned(participant_id, is_claimed)
  WHERE NOT is_claimed;

-- ============================================================================
-- REFERRAL INVITES (warm-intro tracking)
-- ============================================================================
CREATE TABLE referral_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_name TEXT,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('consumer', 'distributor')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'clicked', 'converted')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  UNIQUE(participant_id, referred_email)
);

CREATE INDEX idx_referral_invites_participant ON referral_invites(participant_id);
CREATE INDEX idx_referral_invites_email ON referral_invites(referred_email);

-- ============================================================================
-- DISTRIBUTOR LEADS
-- ============================================================================
CREATE TABLE distributor_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  business_type TEXT NOT NULL CHECK (business_type IN (
    'bar_restaurant', 'liquor_store', 'distributor', 'event_venue', 'other'
  )),
  volume_interest TEXT CHECK (volume_interest IN ('small', 'medium', 'large')),
  message TEXT,
  referral_participant_id UUID REFERENCES referral_participants(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'negotiating', 'converted', 'declined'
  )),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_distributor_leads_status ON distributor_leads(status);
CREATE INDEX idx_distributor_leads_referrer ON distributor_leads(referral_participant_id)
  WHERE referral_participant_id IS NOT NULL;
CREATE INDEX idx_distributor_leads_email ON distributor_leads(email);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER referral_participants_updated_at
  BEFORE UPDATE ON referral_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER distributor_leads_updated_at
  BEFORE UPDATE ON distributor_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE referral_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_code_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards_earned ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_leads ENABLE ROW LEVEL SECURITY;

-- Staff can read all referral data
CREATE POLICY "Staff can read referral participants"
  ON referral_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read referral code history"
  ON referral_code_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read referral events"
  ON referral_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Anyone can read active reward tiers"
  ON referral_reward_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can read all reward tiers"
  ON referral_reward_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read referral rewards earned"
  ON referral_rewards_earned FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read referral invites"
  ON referral_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read distributor leads"
  ON distributor_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can update distributor leads"
  ON distributor_leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- ============================================================================
-- SEED DEFAULT REWARD TIERS
-- ============================================================================
INSERT INTO referral_reward_tiers (tier_name, tier_order, min_consumer_signups, min_distributor_leads, min_paid_conversions, reward_type, reward_value, description)
VALUES
  ('Pack Runner', 1, 3, 0, 0, 'points', '{"points": 100}', 'Refer 3 friends who sign up and earn 100 bonus loyalty points'),
  ('Territory Scout', 2, 5, 1, 0, 'free_product', '{"product": "variety_4pack"}', 'Refer 5 friends + 1 distributor lead and earn a free Variety 4-Pack'),
  ('Alpha Predator', 3, 10, 3, 0, 'merch', '{"item": "merch_bundle"}', 'Refer 10 friends + 3 distributor leads and earn the Untamed Merch Bundle'),
  ('Pride Leader', 4, 25, 5, 0, 'custom', '{"description": "VIP founding member status + exclusive merch drop"}', 'Refer 25 friends + 5 distributor leads for VIP founding member status');
