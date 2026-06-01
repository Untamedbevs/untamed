-- ============================================================================
-- Untamed Beverages - Portal Receipts (multi-image) + Rewards Redemptions
--
-- Adds:
--  1. loyalty_receipt_assets: normalized image rows for loyalty_receipts so a
--     single receipt can have multiple photos. Mirrors the ugc_submission_assets
--     pattern. The legacy single-image path keeps working because we still
--     populate loyalty_receipts.image_url with the first asset's URL.
--  2. loyalty_redemptions: tracks consumer points-catalog redemptions with a
--     pending -> fulfilled / cancelled lifecycle. Points are deducted via
--     loyalty_transactions (type='redemption' was already in the CHECK from
--     migration 00004) and refunded on cancel.
--
-- All inserts are expected to flow through the service-role API (no end-user
-- INSERT policies). End users get SELECT on their own rows; non-limited staff
-- get full read + update for fulfillment.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. loyalty_receipt_assets
-- ============================================================================
CREATE TABLE loyalty_receipt_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES loyalty_receipts(id) ON DELETE CASCADE,
  s3_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_receipt_assets_receipt_id
  ON loyalty_receipt_assets(receipt_id);

ALTER TABLE loyalty_receipt_assets ENABLE ROW LEVEL SECURITY;

-- End user: read assets for their own receipts (linked through loyalty_members)
CREATE POLICY "End users can read own loyalty receipt assets"
  ON loyalty_receipt_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM loyalty_receipts r
      JOIN loyalty_members m ON m.id = r.member_id
      WHERE r.id = loyalty_receipt_assets.receipt_id
        AND m.auth_user_id = auth.uid()
    )
  );

-- Non-limited staff: read all
CREATE POLICY "Non-limited staff can read loyalty receipt assets"
  ON loyalty_receipt_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- ============================================================================
-- 2. loyalty_redemptions
-- ============================================================================
CREATE TYPE loyalty_redemption_status AS ENUM (
  'pending',
  'fulfilled',
  'cancelled'
);

CREATE TABLE loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  reward_slug TEXT NOT NULL,
  reward_label TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost >= 0),
  status loyalty_redemption_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  refund_transaction_id UUID REFERENCES loyalty_transactions(id) ON DELETE SET NULL,
  redeem_transaction_id UUID REFERENCES loyalty_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_redemptions_member_id ON loyalty_redemptions(member_id);
CREATE INDEX idx_loyalty_redemptions_status ON loyalty_redemptions(status);
CREATE INDEX idx_loyalty_redemptions_created_at
  ON loyalty_redemptions(created_at DESC);

CREATE TRIGGER loyalty_redemptions_updated_at
  BEFORE UPDATE ON loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- End user: read own redemptions
CREATE POLICY "End users can read own loyalty redemptions"
  ON loyalty_redemptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_redemptions.member_id
        AND loyalty_members.auth_user_id = auth.uid()
    )
  );

-- Non-limited staff: read all
CREATE POLICY "Non-limited staff can read loyalty redemptions"
  ON loyalty_redemptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- Non-limited staff: update for fulfillment
CREATE POLICY "Non-limited staff can update loyalty redemptions"
  ON loyalty_redemptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

COMMIT;
