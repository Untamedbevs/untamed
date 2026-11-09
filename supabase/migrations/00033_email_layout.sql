-- ============================================================================
-- Email: per-template look. 'branded' is the dark card layout every email has
-- used so far; 'plain' reads like a personal email (src/lib/email/render.ts).
-- Campaigns copy the layout when queued so the send worker renders each blast
-- the way it was previewed, even if the template changes later.
-- ============================================================================

BEGIN;

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'branded'
    CHECK (layout IN ('branded', 'plain'));

ALTER TABLE messaging_campaigns
  ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'branded'
    CHECK (layout IN ('branded', 'plain'));

COMMIT;
