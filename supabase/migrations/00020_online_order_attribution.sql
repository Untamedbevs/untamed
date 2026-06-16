-- ============================================================================
-- Untamed Beverages - Online Order Attribution (AccelPay)
--
-- Ties every AccelPay online order into BOTH attribution systems:
--   1. Base attribution (visitors / UTM first-touch) -- so online revenue can
--      be attributed to marketing source/medium/campaign, exactly like
--      signup-created loyalty members.
--   2. Referral attribution -- a per-order `paid_conversion` for the referrer.
--
-- The AccelPay `new_order` webhook payload carries NO attribution data, so the
-- linkage is captured client-side from the `bc-sale` event (where the browser
-- still has the `ut_visitor_id` and `ut_ref` cookies + the AccelPay sale id)
-- and POSTed to /api/tracking/attribute-order. This durable table is the
-- race-safe store that can exist before OR after the loyalty_orders row.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Durable attribution store, keyed by AccelPay sale id
-- ----------------------------------------------------------------------------
CREATE TABLE loyalty_order_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accelpay_sale_id BIGINT UNIQUE NOT NULL,
  -- Base attribution: the visitor fingerprint cookie (ut_visitor_id).
  visitor_fingerprint TEXT,
  -- Referral attribution: the ut_ref cookie value (a referral code).
  ref_code TEXT,
  -- UTM snapshot + visitor->member link has been applied to the order.
  attribution_applied BOOLEAN NOT NULL DEFAULT false,
  -- Referral paid_conversion has been fired (once-per-order guard).
  conversion_credited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_order_attributions_fingerprint
  ON loyalty_order_attributions(visitor_fingerprint)
  WHERE visitor_fingerprint IS NOT NULL;
CREATE INDEX idx_loyalty_order_attributions_ref_code
  ON loyalty_order_attributions(ref_code)
  WHERE ref_code IS NOT NULL;

CREATE TRIGGER loyalty_order_attributions_updated_at
  BEFORE UPDATE ON loyalty_order_attributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Per-order attribution snapshot on loyalty_orders
--    Mirrors loyalty_members first-touch fields for consistent reporting
--    (revenue by utm_source / campaign).
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_orders
  ADD COLUMN IF NOT EXISTS visitor_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS attributed_ref_code TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_source TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS first_landing_page TEXT,
  ADD COLUMN IF NOT EXISTS first_referrer TEXT;

CREATE INDEX IF NOT EXISTS idx_loyalty_orders_first_utm_source
  ON loyalty_orders(first_utm_source)
  WHERE first_utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_orders_attributed_ref_code
  ON loyalty_orders(attributed_ref_code)
  WHERE attributed_ref_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. RLS: writes flow through the service-role API only.
--    Non-limited staff can read attributions for reporting.
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_order_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-limited staff can read order attributions"
  ON loyalty_order_attributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

COMMIT;
