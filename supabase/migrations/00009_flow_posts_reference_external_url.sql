-- Optional public image URL for a line (e.g. drink can from site assets before it exists in media library)

ALTER TABLE flow_posts
  ADD COLUMN IF NOT EXISTS reference_external_url TEXT;

COMMENT ON COLUMN flow_posts.reference_external_url IS
  'Public URL used as primary reference when reference_source_sort_order and reference_media_id are not used (e.g. /images/can-*.png via full site URL).';
