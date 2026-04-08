-- Plan chaining: use another line's generated image as edit/video input (by sort_order within the flow)

ALTER TABLE flow_posts
  ADD COLUMN IF NOT EXISTS reference_source_sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS end_frame_source_sort_order INTEGER;

COMMENT ON COLUMN flow_posts.reference_source_sort_order IS
  'If set, use the flow post with this sort_order generated image as primary reference when that output exists.';

COMMENT ON COLUMN flow_posts.end_frame_source_sort_order IS
  'If set, use that post generated image as video end frame (e.g. Veo first+last).';
