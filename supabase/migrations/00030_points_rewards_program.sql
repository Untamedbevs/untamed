-- ============================================================================
-- Untamed Beverages - Pack Rewards: milestones, reward catalog, promotions
--
-- 1. reward_items: rewards staff can offer (gift cards, merch, experiences).
-- 2. reward_milestones: markers on the member's points trail. Reaching one
--    unlocks its reward, claimed once per member.
-- 3. reward_milestone_claims: each claim, with a snapshot of the reward, for
--    staff to fulfill.
-- 4. promotions ("Hunts" in the portal): tasks members complete for points,
--    with the proof each one accepts (link, screenshot, note).
-- 5. promotion_submissions: member proof, reviewed by staff. Approval credits
--    points through loyalty_apply_points() with the new 'promotion' type.
--
-- The trail counts engagement points (enrolling, friends, approved content,
-- promotions, staff bonuses), never purchases. Everything here is additive;
-- members see it only once Pack Rewards leaves the staff preview.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Reward catalog
-- ----------------------------------------------------------------------------
CREATE TABLE reward_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'gift_card'
    CHECK (kind IN ('gift_card', 'merch', 'experience', 'other')),
  -- Approximate retail value; counts toward the member's yearly reward cap.
  value_cents INTEGER NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  icon TEXT,
  -- Staff-facing: how to fulfill (brand, where to buy, who sends it).
  fulfillment_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. Milestones on the points trail
-- ----------------------------------------------------------------------------
CREATE TABLE reward_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  points INTEGER NOT NULL CHECK (points > 0),
  title TEXT NOT NULL,
  tagline TEXT,
  icon TEXT,
  -- NULL: a marker with no reward (recognition only).
  reward_id UUID REFERENCES reward_items(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reward_milestones_points ON reward_milestones(points) WHERE is_active;

-- ----------------------------------------------------------------------------
-- 3. Milestone claims
-- ----------------------------------------------------------------------------
CREATE TABLE reward_milestone_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES reward_milestones(id) ON DELETE RESTRICT,
  reward_id UUID REFERENCES reward_items(id) ON DELETE SET NULL,
  -- Snapshot, so catalog edits never change a claim.
  reward_name TEXT NOT NULL,
  reward_kind TEXT NOT NULL,
  value_cents INTEGER NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  points_at_claim INTEGER NOT NULL,
  ship_state CHAR(2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  staff_note TEXT,
  fulfilled_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, milestone_id)
);

CREATE INDEX idx_reward_milestone_claims_status ON reward_milestone_claims(status, created_at);
CREATE INDEX idx_reward_milestone_claims_member ON reward_milestone_claims(member_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Promotions
-- ----------------------------------------------------------------------------
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title TEXT NOT NULL,
  summary TEXT,
  instructions TEXT,
  -- Member-facing rules; members confirm each one when they submit.
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Staff-facing checks for the reviewer.
  review_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  points INTEGER NOT NULL CHECK (points > 0),
  -- Which proof the member gives: 'off', 'optional' or 'required'.
  url_mode TEXT NOT NULL DEFAULT 'required' CHECK (url_mode IN ('off', 'optional', 'required')),
  image_mode TEXT NOT NULL DEFAULT 'off' CHECK (image_mode IN ('off', 'optional', 'required')),
  text_mode TEXT NOT NULL DEFAULT 'off' CHECK (text_mode IN ('off', 'optional', 'required')),
  -- Links must be on one of these hosts (or a subdomain). Empty: any https link.
  url_hosts TEXT[] NOT NULL DEFAULT '{}',
  url_label TEXT,
  icon TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_per_member INTEGER NOT NULL DEFAULT 1 CHECK (max_per_member > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (url_mode <> 'off' OR image_mode <> 'off' OR text_mode <> 'off'),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

-- ----------------------------------------------------------------------------
-- 5. Promotion submissions
-- ----------------------------------------------------------------------------
CREATE TABLE promotion_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  proof_url TEXT,
  proof_image_key TEXT,
  proof_text TEXT,
  -- The requirements the member confirmed, as shown at submit time.
  attestations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  transaction_id UUID REFERENCES loyalty_transactions(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (proof_url IS NOT NULL OR proof_image_key IS NOT NULL OR proof_text IS NOT NULL)
);

CREATE INDEX idx_promotion_submissions_status ON promotion_submissions(status, created_at);
CREATE INDEX idx_promotion_submissions_member ON promotion_submissions(member_id, promotion_id);

-- ----------------------------------------------------------------------------
-- 6. Ledger type for approved promotions
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_transactions
  DROP CONSTRAINT loyalty_transactions_type_check;

ALTER TABLE loyalty_transactions
  ADD CONSTRAINT loyalty_transactions_type_check
  CHECK (type IN (
    'receipt_approved',
    'signup_bonus',
    'redemption',
    'adjustment',
    'ugc_approved',
    'online_order',
    'referral_signup',
    'referral_purchase',
    'reversal',
    'expiration',
    'promotion'
  ));

-- ----------------------------------------------------------------------------
-- 7. updated_at triggers and RLS (the app reads and writes with the service
--    role; staff get read access like the other loyalty tables)
-- ----------------------------------------------------------------------------
CREATE TRIGGER reward_items_updated_at BEFORE UPDATE ON reward_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reward_milestones_updated_at BEFORE UPDATE ON reward_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reward_milestone_claims_updated_at BEFORE UPDATE ON reward_milestone_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER promotion_submissions_updated_at BEFORE UPDATE ON promotion_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_milestone_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read reward items" ON reward_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read reward milestones" ON reward_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Staff can read promotions" ON promotions FOR SELECT
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true));
CREATE POLICY "Non-limited staff can read milestone claims" ON reward_milestone_claims FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true AND staff.role <> 'contractor_limited'
  ));
CREATE POLICY "Non-limited staff can read promotion submissions" ON promotion_submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.auth_user_id = auth.uid() AND staff.is_active = true AND staff.role <> 'contractor_limited'
  ));

-- ----------------------------------------------------------------------------
-- 8. Starting catalog, trail and first promotion (staff can change all of it)
-- ----------------------------------------------------------------------------
WITH items AS (
  INSERT INTO reward_items (name, description, kind, value_cents, icon, fulfillment_note) VALUES
    ('$5 gift card',   'A digital gift card, emailed to you.', 'gift_card',  500, 'gift-bronze',   'Placeholder: choose the gift card brand, and confirm gift cards with counsel before launch.'),
    ('$10 gift card',  'A digital gift card, emailed to you.', 'gift_card', 1000, 'gift-silver',   'Placeholder: choose the gift card brand, and confirm gift cards with counsel before launch.'),
    ('$25 gift card',  'A digital gift card, emailed to you.', 'gift_card', 2500, 'gift-gold',     'Placeholder: choose the gift card brand, and confirm gift cards with counsel before launch.'),
    ('$50 gift card',  'A digital gift card, emailed to you.', 'gift_card', 5000, 'gift-platinum', 'Placeholder: choose the gift card brand, and confirm gift cards with counsel before launch.'),
    ('$100 gift card', 'A digital gift card, emailed to you.', 'gift_card', 10000, 'obsidian-vault', 'Placeholder: choose the gift card brand, and confirm gift cards with counsel before launch.'),
    ('$150 gift card', 'A digital gift card, emailed to you.', 'gift_card', 15000, 'gift-haul',     'Placeholder: choose the gift card brand, and confirm gift cards with counsel before launch.')
  RETURNING id, value_cents
)
INSERT INTO reward_milestones (points, title, tagline, icon, reward_id)
SELECT m.points, m.title, m.tagline, m.icon, (SELECT id FROM items WHERE value_cents = m.value_cents)
FROM (VALUES
  (2500,   'First Tracks',     'You left your mark. The trail is yours now.',   'first-tracks',   NULL),
  (5000,   'Scout''s Stash',   'First stash cracked open.',                     'gift-bronze',    500),
  (10000,  'Stalker''s Stash', 'Locked on. Closing in.',                        'gift-silver',    1000),
  (25000,  'Hunter''s Haul',   'You eat what you hunt.',                        'gift-gold',      2500),
  (50000,  'Alpha Vault',      'The pack moves when you move.',                 'gift-platinum',  5000),
  (100000, 'Apex Treasure',    'Nothing hunts you.',                            'obsidian-vault', 10000),
  (200000, 'Legend''s Summit', 'They tell stories about you.',                  'summit-crest',   15000)
) AS m(points, title, tagline, icon, value_cents);

INSERT INTO promotions (
  slug, title, summary, instructions, requirements, review_checklist, points,
  url_mode, image_mode, text_mode, url_hosts, url_label, icon, max_per_member
) VALUES (
  'fifty-like-hunt',
  'The Fifty-Like Hunt',
  'Post your Untamed moment on Facebook. Hit 50 likes and earn 5,000 points.',
  E'Post a photo or video of your Untamed moment on Facebook.\nSet the post to Public and tag Untamed Beverages.\nAdd #UntamedPack and #ad so friends know you earn rewards.\nOnce it passes 50 likes, tap Share, then Copy link, and paste it here.',
  '["My post is set to Public, so anyone can see it", "It shows Untamed and tags Untamed Beverages", "The caption includes #UntamedPack and #ad", "Everyone in it is 21 or older", "It has at least 50 likes right now", "It''s my own post, from my own account"]'::jsonb,
  '["The link opens while signed out of Facebook (the post is public)", "The post shows Untamed and tags the Untamed Beverages page", "The caption has #ad or another clear rewards disclosure", "50 or more likes are visible", "Everyone pictured looks 25 or older (DISCUS guideline)", "Posted from the member''s own account (the name matches)"]'::jsonb,
  5000,
  'required', 'optional', 'off',
  '{facebook.com,fb.com,fb.me}',
  'Facebook post link',
  'like-storm',
  1
);

-- Campaign templates for the email system, ready for launch.
INSERT INTO email_templates (slug, name, kind, subject, body, default_audience) VALUES
(
  'pack-rewards-hunt-launch',
  'Pack Rewards launch: a new Hunt is live',
  'campaign',
  'A new Hunt just dropped, {{first_name}}',
  E'Hey {{first_name}},\n\nThere''s a new Hunt in your Untamed portal. Complete it, send us the proof, and we''ll add the points to your trail.\n\nSee this week''s Hunts:\n{{hunts_url}}\n\nEvery milestone on your trail unlocks a reward.\n\nStay wild,\nThe Untamed crew',
  'loyalty'
),
(
  'pack-rewards-trail',
  'Pack Rewards launch: your rewards trail is open',
  'campaign',
  'Your rewards trail is open, {{first_name}}',
  E'{{first_name}},\n\nPack Rewards is here. Every point you earn moves you up your trail, and every milestone unlocks a reward.\n\nSee where you stand and what''s next:\n{{rewards_url}}\n\nStay wild,\nThe Untamed crew',
  'loyalty'
);

COMMIT;
