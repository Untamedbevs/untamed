-- ============================================================================
-- Untamed Beverages - End-User Authentication
-- Adds Supabase Auth login for loyalty members and distributor leads so they
-- can own UGC submissions, view their points, and access a member portal.
--
-- Existing staff auth is unchanged. End-user accounts live in auth.users and
-- are linked back to loyalty_members / distributor_leads by email on first
-- sign-in via a trigger.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. auth_user_id columns on identity tables
-- ============================================================================
ALTER TABLE loyalty_members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE distributor_leads
  ADD COLUMN IF NOT EXISTS auth_user_id UUID
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_members_auth_user_id
  ON loyalty_members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distributor_leads_auth_user_id
  ON distributor_leads(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- distributor_leads.email is not unique (same business can submit multiple
-- leads). When an auth user signs in, we link ALL leads with that email so
-- the member portal can show a unified history. distributor_leads.auth_user_id
-- is therefore NOT unique.

-- ============================================================================
-- 2. Identity-link function
-- Called from a trigger on auth.users INSERT. Stamps auth_user_id onto every
-- existing loyalty_members and distributor_leads row whose email matches.
-- ============================================================================
CREATE OR REPLACE FUNCTION link_auth_user_to_identities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := lower(NEW.email);
  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE loyalty_members
    SET auth_user_id = NEW.id, updated_at = now()
    WHERE lower(email) = user_email
      AND auth_user_id IS NULL;

  UPDATE distributor_leads
    SET auth_user_id = NEW.id, updated_at = now()
    WHERE lower(email) = user_email
      AND auth_user_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_auth_user_to_identities_trigger ON auth.users;
CREATE TRIGGER link_auth_user_to_identities_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION link_auth_user_to_identities();

-- ============================================================================
-- 3. Helper view + function for the portal
-- Returns the resolved member identity for a given auth user. Used by
-- src/lib/auth/resolve-member.ts to avoid round-trips.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_member_identity(p_auth_user_id UUID)
RETURNS TABLE (
  loyalty_member_id UUID,
  loyalty_email TEXT,
  loyalty_first_name TEXT,
  loyalty_points_balance INTEGER,
  distributor_lead_id UUID,
  distributor_business_name TEXT,
  distributor_contact_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lm.id,
    lm.email,
    lm.first_name,
    lm.points_balance,
    dl.id,
    dl.business_name,
    dl.contact_name
  FROM (SELECT 1) AS dummy
  LEFT JOIN loyalty_members lm ON lm.auth_user_id = p_auth_user_id
  LEFT JOIN distributor_leads dl ON dl.auth_user_id = p_auth_user_id
  LIMIT 1;
$$;

-- ============================================================================
-- 4. RLS policies for end-user portal access
-- End users can read their own loyalty record, receipts, and transactions.
-- Existing staff policies remain in place.
-- ============================================================================

-- loyalty_members: read own record
CREATE POLICY "End users can read own loyalty record"
  ON loyalty_members FOR SELECT
  USING (auth_user_id = auth.uid());

-- loyalty_receipts: read own receipts
CREATE POLICY "End users can read own loyalty receipts"
  ON loyalty_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_receipts.member_id
        AND loyalty_members.auth_user_id = auth.uid()
    )
  );

-- loyalty_transactions: read own transactions
CREATE POLICY "End users can read own loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_transactions.member_id
        AND loyalty_members.auth_user_id = auth.uid()
    )
  );

-- distributor_leads: read own leads
CREATE POLICY "End users can read own distributor leads"
  ON distributor_leads FOR SELECT
  USING (auth_user_id = auth.uid());

-- referral_participants: read own participant record (linked through loyalty)
CREATE POLICY "End users can read own referral participant"
  ON referral_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = referral_participants.loyalty_member_id
        AND loyalty_members.auth_user_id = auth.uid()
    )
  );

COMMIT;
