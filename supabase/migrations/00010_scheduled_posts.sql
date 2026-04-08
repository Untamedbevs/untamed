-- Scheduled posts table for the content posting queue
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  media_ids UUID[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  title TEXT,
  caption TEXT,
  body TEXT,
  hashtags TEXT[] DEFAULT '{}',
  link_url TEXT,
  call_to_action TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','publishing','posted','failed','cancelled')),
  posted_at TIMESTAMPTZ,
  publish_result JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scheduled_posts_status_at ON scheduled_posts (status, scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_posts_flow ON scheduled_posts (flow_id);
