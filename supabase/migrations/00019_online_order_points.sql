-- ============================================================================
-- Untamed Beverages - Online Order Loyalty Points (AccelPay)
--
-- Online purchases made through the AccelPay/BevCart storefront now earn
-- loyalty points automatically (no receipt upload required). Receipt uploads
-- remain for IN-STORE / ON-PREMISE purchases only.
--
-- Source of truth: AccelPay `new_order` webhook -> /api/webhooks/untamed-orders.
-- Each AccelPay sale is recorded once (idempotent on accelpay_sale_id). If the
-- buyer's email matches a loyalty_member, points are credited immediately. If
-- not, the order is held as a PENDING credit (member_id NULL, points_claimed
-- false) and auto-claimed when someone signs up / logs in with that email.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Allow the new transaction type
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
    'online_order'
  ));

-- ----------------------------------------------------------------------------
-- 2. loyalty_orders: one row per AccelPay sale we've seen
-- ----------------------------------------------------------------------------
CREATE TABLE loyalty_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accelpay_sale_id BIGINT UNIQUE NOT NULL,
  member_id UUID REFERENCES loyalty_members(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  delivery_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  pack_count INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  -- false until the points have actually been credited to a member's balance
  points_claimed BOOLEAN NOT NULL DEFAULT false,
  items JSONB,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_orders_member_id ON loyalty_orders(member_id);
CREATE INDEX idx_loyalty_orders_email ON loyalty_orders(lower(email));
CREATE INDEX idx_loyalty_orders_unclaimed
  ON loyalty_orders(points_claimed)
  WHERE points_claimed = false;

CREATE TRIGGER loyalty_orders_updated_at
  BEFORE UPDATE ON loyalty_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Link the points ledger back to the originating order
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_transactions
  ADD COLUMN order_id UUID REFERENCES loyalty_orders(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. RLS: end users read their own orders; non-limited staff read all.
--    All writes flow through the service-role API (no insert/update policies).
-- ----------------------------------------------------------------------------
ALTER TABLE loyalty_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "End users can read own loyalty orders"
  ON loyalty_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_orders.member_id
        AND loyalty_members.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Non-limited staff can read loyalty orders"
  ON loyalty_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

COMMIT;
