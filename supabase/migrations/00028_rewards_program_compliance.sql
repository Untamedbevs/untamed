-- ============================================================================
-- Untamed Beverages - Pack Rewards compliance foundation
--
-- Untamed sells spirits (15% ABV vodka martinis), so the rewards and referral
-- program has to follow federal and state alcohol rules. This migration adds
-- what the app needs to enforce them (the rules themselves live in
-- src/lib/rewards/):
--
--   1. Enrollment on loyalty_members: date of birth (21+), state of residence,
--      accepted Program Rules version, program status, and a trade-account flag
--      (alcohol licensees and their employees can never earn).
--   2. loyalty_program_consents: an append-only log of every enrollment with
--      the exact rules version, attestations, and request fingerprint.
--   3. Referral attribution on the referred member, so a person can only ever
--      be credited to one referrer, once, and only after they enroll.
--   4. Ledger types for reversals and expirations, the retail value and ship
--      state of each redemption (annual value caps), and the ship state of
--      each online order (state-based earning).
--   5. loyalty_apply_points(): one atomic, row-locked balance change used by
--      every credit and debit, replacing read-modify-write updates.
--
-- Existing members keep their balance. They must enroll (birthdate, state,
-- Program Rules) before they can earn more or redeem.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Enrollment and eligibility
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_members
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS residence_state CHAR(2),
  ADD COLUMN IF NOT EXISTS program_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS program_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS program_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS program_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_trade_account BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by_participant_id UUID
    REFERENCES referral_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_credited_at TIMESTAMPTZ;

ALTER TABLE loyalty_members
  ADD CONSTRAINT loyalty_members_program_status_check
  CHECK (program_status IN ('active', 'suspended', 'closed'));

ALTER TABLE loyalty_members
  ADD CONSTRAINT loyalty_members_residence_state_check
  CHECK (residence_state IS NULL OR residence_state ~ '^[A-Z]{2}$');

ALTER TABLE loyalty_members
  ADD CONSTRAINT loyalty_members_birthdate_check
  CHECK (birthdate IS NULL OR birthdate >= DATE '1900-01-01');

-- Enrollment requires a birthdate and state (the 21+ check runs in the app,
-- which computes age conservatively in the earliest US time zone).
ALTER TABLE loyalty_members
  ADD CONSTRAINT loyalty_members_enrollment_complete_check
  CHECK (
    program_enrolled_at IS NULL
    OR (birthdate IS NOT NULL AND residence_state IS NOT NULL AND program_terms_version IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_loyalty_members_enrolled
  ON loyalty_members(program_enrolled_at)
  WHERE program_enrolled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_members_referred_by
  ON loyalty_members(referred_by_participant_id)
  WHERE referred_by_participant_id IS NOT NULL;

-- Anyone who has submitted a business (retail, bar, distributor) inquiry is a
-- trade contact. Giving them points would be a thing of value from a supplier
-- to a licensee, so flag them. Staff can clear the flag after review.
UPDATE loyalty_members m
SET is_trade_account = true
FROM distributor_leads d
WHERE lower(d.email) = lower(m.email)
  AND m.is_trade_account = false;

-- Trade contacts were auto-enrolled as referrers by the old lead form. Their
-- referral links stay active for now: switching them off changes live
-- referral tracking, so it ships with the full program launch, not this
-- staff preview.

-- ----------------------------------------------------------------------------
-- 2. Enrollment consent log (append-only; no update/delete policies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_program_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  terms_version TEXT NOT NULL,
  residence_state CHAR(2) NOT NULL,
  birthdate DATE NOT NULL,
  -- { "of_age": true, "not_trade": true, "accepts_rules": true, "discloses_referrals": true }
  attestations JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_program_consents_member
  ON loyalty_program_consents(member_id, created_at DESC);

ALTER TABLE loyalty_program_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "End users can read own program consents"
  ON loyalty_program_consents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_program_consents.member_id
        AND loyalty_members.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Non-limited staff can read program consents"
  ON loyalty_program_consents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Ledger types, redemption value, order ship state
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
    'expiration'
  ));

ALTER TABLE loyalty_redemptions
  ADD COLUMN IF NOT EXISTS retail_value_cents INTEGER NOT NULL DEFAULT 0
    CHECK (retail_value_cents >= 0),
  ADD COLUMN IF NOT EXISTS ship_state CHAR(2);

ALTER TABLE loyalty_orders
  ADD COLUMN IF NOT EXISTS ship_state CHAR(2),
  -- Why an order's points are held instead of credited (not enrolled,
  -- state not eligible, trade account). NULL once credited.
  ADD COLUMN IF NOT EXISTS points_hold_reason TEXT;

-- ----------------------------------------------------------------------------
-- 4. Atomic balance change
--
-- Locks the member row, refuses to go negative, writes the ledger row, and
-- updates the balance in one statement batch. Service role only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION loyalty_apply_points(
  p_member_id UUID,
  p_points INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_order_id UUID DEFAULT NULL,
  p_receipt_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL
)
RETURNS TABLE (transaction_id UUID, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_txn UUID;
BEGIN
  SELECT COALESCE(points_balance, 0) INTO v_balance
  FROM loyalty_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'loyalty member % not found', p_member_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_balance + p_points < 0 THEN
    RAISE EXCEPTION 'insufficient points: balance %, change %', v_balance, p_points
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO loyalty_transactions (
    member_id, points, type, description, order_id, receipt_id, created_by_staff_id
  )
  VALUES (
    p_member_id, p_points, p_type, p_description, p_order_id, p_receipt_id, p_staff_id
  )
  RETURNING id INTO v_txn;

  UPDATE loyalty_members
  SET points_balance = v_balance + p_points
  WHERE id = p_member_id;

  RETURN QUERY SELECT v_txn, v_balance + p_points;
END;
$$;

REVOKE ALL ON FUNCTION loyalty_apply_points(UUID, INTEGER, TEXT, TEXT, UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION loyalty_apply_points(UUID, INTEGER, TEXT, TEXT, UUID, UUID, UUID)
  TO service_role;

COMMIT;
