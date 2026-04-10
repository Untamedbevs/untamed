-- Middle review state: has generated asset, not approved or rejected yet.
ALTER TABLE flow_posts DROP CONSTRAINT IF EXISTS flow_posts_status_check;
ALTER TABLE flow_posts ADD CONSTRAINT flow_posts_status_check
  CHECK (status IN ('pending', 'generating', 'complete', 'approved', 'rejected', 'maybe'));
