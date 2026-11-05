-- ============================================================================
-- Email: "Team" audience for internal test sends (yourself, founders, admins).
-- The staff audience is resolved in app code (src/lib/crm/blast-filters.ts);
-- this only widens the template default-audience check and seeds "Just me".
-- ============================================================================

BEGIN;

ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_default_audience_check;
ALTER TABLE email_templates
  ADD CONSTRAINT email_templates_default_audience_check
  CHECK (default_audience IN ('loyalty', 'referrers', 'distributors', 'all', 'staff'));

INSERT INTO email_segments (name, description, filters) VALUES
  ('Just me', 'Only the signed-in staff member sending the blast', '{"audience":"staff","only_me":true}')
ON CONFLICT (name) DO NOTHING;

COMMIT;
