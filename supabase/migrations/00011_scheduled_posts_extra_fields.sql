-- Add post detail fields to scheduled_posts
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS call_to_action TEXT;
