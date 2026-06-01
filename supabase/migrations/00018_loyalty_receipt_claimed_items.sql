-- ============================================================================
-- Untamed Beverages - Receipt claimed line items
--
-- Adds a JSONB column to loyalty_receipts so portal users can self-declare
-- what they bought ("8 packs of Cheetah, 2 of Lioness") alongside their
-- receipt photos. The photo remains the source of truth — admin still
-- approves — but having structured items speeds review and lets the system
-- pre-suggest a points award (sum_of_quantities * POINTS.PER_RECEIPT).
--
-- Shape:
--   [
--     { "drinkSlug": "cheetah", "quantity": 8 },
--     { "drinkSlug": "lioness", "quantity": 2 }
--   ]
-- ============================================================================

ALTER TABLE loyalty_receipts
  ADD COLUMN IF NOT EXISTS claimed_items JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN loyalty_receipts.claimed_items
  IS 'Self-declared line items from the portal uploader. Array of { drinkSlug, quantity }. Admin reviews against photos.';
