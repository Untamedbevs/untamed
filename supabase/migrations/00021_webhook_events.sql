-- ============================================================================
-- Untamed Beverages - Raw Webhook Event Capture (AccelPay)
--
-- A discovery/debugging log: stores the FULL raw body of every incoming
-- AccelPay webhook (orders + fulfillment), regardless of whether we could parse
-- it. Use it to inspect exactly what AccelPay sends for each event type so we
-- can decide what's worth persisting on `loyalty_orders`.
--
-- Writes are best-effort from the webhook receivers (failures never block order
-- processing). Safe to truncate at any time.
-- ============================================================================

BEGIN;

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which receiver captured it: 'untamed-orders' | 'untamed-order-fulfillment'.
  source TEXT NOT NULL,
  -- Best-effort top-level event/action label pulled from the payload.
  event_type TEXT,
  -- Best-effort AccelPay sale id pulled from the payload.
  accelpay_sale_id BIGINT,
  -- The full raw request body, exactly as received.
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_events_source ON webhook_events(source);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at DESC);
CREATE INDEX idx_webhook_events_sale_id ON webhook_events(accelpay_sale_id)
  WHERE accelpay_sale_id IS NOT NULL;

-- RLS: writes flow through the service-role API only. Non-limited staff read.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-limited staff can read webhook events"
  ON webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

COMMIT;
