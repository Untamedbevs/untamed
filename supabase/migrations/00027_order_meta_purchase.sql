-- Browser context for the Meta CAPI Purchase event on AccelPay orders.
-- Captured client-side at `bc-sale` (the order webhook has no browser context)
-- so the server Purchase can carry Meta's click/browser ids.

ALTER TABLE loyalty_order_attributions
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS client_ip TEXT,
  ADD COLUMN IF NOT EXISTS client_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS event_source_url TEXT;

-- Claim flag so the Purchase is sent exactly once, whichever path (client
-- attribution, order webhook, reconcile cron) gets there first.
ALTER TABLE loyalty_orders
  ADD COLUMN IF NOT EXISTS meta_purchase_sent_at TIMESTAMPTZ;

-- Orders before this migration were already reported (or predate CAPI).
UPDATE loyalty_orders SET meta_purchase_sent_at = created_at WHERE meta_purchase_sent_at IS NULL;
