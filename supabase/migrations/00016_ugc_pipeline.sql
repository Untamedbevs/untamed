-- ============================================================================
-- Untamed Beverages - UGC Pipeline
-- User-generated content submissions from loyalty members and distributors:
-- photos and videos, reviewed by staff, optionally promoted to staff media
-- library and/or shown on the public community gallery.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Enums
-- ============================================================================
CREATE TYPE ugc_status AS ENUM ('pending', 'approved', 'rejected', 'featured');
CREATE TYPE ugc_contributor_type AS ENUM ('loyalty', 'distributor', 'staff');
CREATE TYPE ugc_asset_type AS ENUM ('image', 'video');
CREATE TYPE ugc_processing_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');

-- Extend loyalty_transactions.type to include ugc_approved
ALTER TABLE loyalty_transactions
  DROP CONSTRAINT loyalty_transactions_type_check;

ALTER TABLE loyalty_transactions
  ADD CONSTRAINT loyalty_transactions_type_check
  CHECK (type IN ('receipt_approved', 'signup_bonus', 'redemption', 'adjustment', 'ugc_approved'));

-- ============================================================================
-- 2. ugc_submissions -- one row per submission (may contain multiple assets)
-- ============================================================================
CREATE TABLE ugc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contributor_type ugc_contributor_type NOT NULL,
  loyalty_member_id UUID REFERENCES loyalty_members(id) ON DELETE SET NULL,
  distributor_lead_id UUID REFERENCES distributor_leads(id) ON DELETE SET NULL,
  contributor_email TEXT,
  contributor_display_name TEXT,
  caption TEXT,
  drink_slug TEXT CHECK (drink_slug IN ('black-panther', 'cheetah', 'cougar', 'lioness') OR drink_slug IS NULL),
  tags TEXT[] DEFAULT '{}',
  location TEXT,
  consent_granted BOOLEAN NOT NULL DEFAULT false,
  consent_signature TEXT,
  consent_at TIMESTAMPTZ,
  status ugc_status NOT NULL DEFAULT 'pending',
  is_public BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  promoted_media_ids UUID[] NOT NULL DEFAULT '{}',
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ugc_submissions_auth_user_id ON ugc_submissions(auth_user_id);
CREATE INDEX idx_ugc_submissions_status ON ugc_submissions(status);
CREATE INDEX idx_ugc_submissions_contributor_type ON ugc_submissions(contributor_type);
CREATE INDEX idx_ugc_submissions_drink_slug ON ugc_submissions(drink_slug) WHERE drink_slug IS NOT NULL;
CREATE INDEX idx_ugc_submissions_loyalty_member_id ON ugc_submissions(loyalty_member_id) WHERE loyalty_member_id IS NOT NULL;
CREATE INDEX idx_ugc_submissions_public_gallery ON ugc_submissions(created_at DESC)
  WHERE is_public = true AND status IN ('approved', 'featured');
CREATE INDEX idx_ugc_submissions_pending_review ON ugc_submissions(created_at ASC)
  WHERE status = 'pending';

CREATE TRIGGER ugc_submissions_updated_at
  BEFORE UPDATE ON ugc_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. ugc_submission_assets -- one row per file (image or video)
-- ============================================================================
CREATE TABLE ugc_submission_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES ugc_submissions(id) ON DELETE CASCADE,
  asset_type ugc_asset_type NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  mime_type TEXT,
  processed_urls JSONB,
  mediaconvert_job_id TEXT,
  processing_status ugc_processing_status NOT NULL DEFAULT 'uploaded',
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC,
  file_size_bytes BIGINT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ugc_submission_assets_submission_id
  ON ugc_submission_assets(submission_id);
CREATE INDEX idx_ugc_submission_assets_processing_status
  ON ugc_submission_assets(processing_status)
  WHERE processing_status IN ('uploaded', 'processing');
CREATE INDEX idx_ugc_submission_assets_mediaconvert_job_id
  ON ugc_submission_assets(mediaconvert_job_id)
  WHERE mediaconvert_job_id IS NOT NULL;

-- ============================================================================
-- 4. Row Level Security
-- ============================================================================
ALTER TABLE ugc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_submission_assets ENABLE ROW LEVEL SECURITY;

-- ----- ugc_submissions -----

-- Owner can read own submissions
CREATE POLICY "Owners can read own ugc submissions"
  ON ugc_submissions FOR SELECT
  USING (auth_user_id = auth.uid());

-- Owner can insert their own submissions
CREATE POLICY "Owners can create own ugc submissions"
  ON ugc_submissions FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Owner can update only while pending (caption tweaks, soft-delete-via-update)
CREATE POLICY "Owners can update own pending ugc submissions"
  ON ugc_submissions FOR UPDATE
  USING (auth_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (auth_user_id = auth.uid());

-- Owner can delete only while pending
CREATE POLICY "Owners can delete own pending ugc submissions"
  ON ugc_submissions FOR DELETE
  USING (auth_user_id = auth.uid() AND status = 'pending');

-- Public read of approved+public submissions (for /community gallery)
CREATE POLICY "Public can read approved public ugc submissions"
  ON ugc_submissions FOR SELECT
  USING (
    is_public = true
    AND status IN ('approved', 'featured')
  );

-- Staff can read all
CREATE POLICY "Staff can read all ugc submissions"
  ON ugc_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- Staff can update all (for review)
CREATE POLICY "Staff can update ugc submissions"
  ON ugc_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- Admins can delete any submission
CREATE POLICY "Admins can delete ugc submissions"
  ON ugc_submissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role IN ('super_admin', 'admin')
    )
  );

-- ----- ugc_submission_assets -----

-- Owner can read assets for their own submissions
CREATE POLICY "Owners can read own ugc assets"
  ON ugc_submission_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ugc_submissions
      WHERE ugc_submissions.id = ugc_submission_assets.submission_id
        AND ugc_submissions.auth_user_id = auth.uid()
    )
  );

-- Owner can insert assets for their own pending submissions
CREATE POLICY "Owners can create own ugc assets"
  ON ugc_submission_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ugc_submissions
      WHERE ugc_submissions.id = ugc_submission_assets.submission_id
        AND ugc_submissions.auth_user_id = auth.uid()
        AND ugc_submissions.status = 'pending'
    )
  );

-- Public read of assets for approved+public submissions
CREATE POLICY "Public can read approved public ugc assets"
  ON ugc_submission_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ugc_submissions
      WHERE ugc_submissions.id = ugc_submission_assets.submission_id
        AND ugc_submissions.is_public = true
        AND ugc_submissions.status IN ('approved', 'featured')
    )
  );

-- Staff can read all assets
CREATE POLICY "Staff can read all ugc assets"
  ON ugc_submission_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- Staff can update assets (e.g. processed_urls writes from webhook via service role, but admin UI might too)
CREATE POLICY "Staff can update ugc assets"
  ON ugc_submission_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

COMMIT;
