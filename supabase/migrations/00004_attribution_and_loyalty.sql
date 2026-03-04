-- ============================================
-- Untamed Beverages - Attribution & Loyalty
-- ============================================

-- Visitors: anonymous visitor tracking (cookie-based)
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  first_landing_page TEXT,
  first_referrer TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  first_utm_term TEXT,
  first_gclid TEXT,
  first_fbclid TEXT,
  last_utm_source TEXT,
  last_utm_medium TEXT,
  last_utm_campaign TEXT,
  session_count INTEGER DEFAULT 1,
  total_pageviews INTEGER DEFAULT 0,
  loyalty_member_id UUID,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visitors_fingerprint ON visitors(fingerprint);
CREATE INDEX idx_visitors_loyalty_member_id ON visitors(loyalty_member_id);
CREATE INDEX idx_visitors_first_utm_source ON visitors(first_utm_source);
CREATE INDEX idx_visitors_first_seen_at ON visitors(first_seen_at);

-- Sessions: individual visit sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  landing_page TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  fbclid TEXT,
  device_type TEXT,
  browser TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  pageview_count INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_visitor_id ON sessions(visitor_id);
CREATE INDEX idx_sessions_utm_source ON sessions(utm_source);
CREATE INDEX idx_sessions_utm_campaign ON sessions(utm_campaign);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);

-- Loyalty Members: email-based membership
CREATE TABLE loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  visitor_id UUID NOT NULL,
  favorite_drink_slug TEXT,
  points_balance INTEGER DEFAULT 0,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_landing_page TEXT,
  first_referrer TEXT,
  first_seen_at TIMESTAMPTZ,
  total_scans INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_members_email ON loyalty_members(email);
CREATE INDEX idx_loyalty_members_visitor_id ON loyalty_members(visitor_id);
CREATE INDEX idx_loyalty_members_first_utm_source ON loyalty_members(first_utm_source);

-- Add FK from visitors -> loyalty_members now that both tables exist
ALTER TABLE visitors
  ADD CONSTRAINT fk_visitors_loyalty_member
  FOREIGN KEY (loyalty_member_id) REFERENCES loyalty_members(id) ON DELETE SET NULL;

-- Loyalty Receipts: uploaded purchase receipts
CREATE TABLE loyalty_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded INTEGER DEFAULT 0,
  drink_slug TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_loyalty_receipts_member_id ON loyalty_receipts(member_id);
CREATE INDEX idx_loyalty_receipts_status ON loyalty_receipts(status);

-- Loyalty Transactions: points ledger
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receipt_approved', 'signup_bonus', 'redemption', 'adjustment')),
  description TEXT,
  receipt_id UUID REFERENCES loyalty_receipts(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_transactions_member_id ON loyalty_transactions(member_id);
CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions(type);

-- ============================================
-- Updated_at trigger for loyalty_members
-- ============================================

CREATE TRIGGER loyalty_members_updated_at
  BEFORE UPDATE ON loyalty_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Visitors & Sessions: service role only (no anon/authenticated access needed)
-- All inserts go through API routes using the service role client.

-- Staff can read all tracking data
CREATE POLICY "Staff can read visitors"
  ON visitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can read sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- Loyalty members: staff can read all
CREATE POLICY "Staff can read loyalty members"
  ON loyalty_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- Loyalty receipts: staff can read and update
CREATE POLICY "Staff can read loyalty receipts"
  ON loyalty_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

CREATE POLICY "Staff can update loyalty receipts"
  ON loyalty_receipts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );

-- Loyalty transactions: staff can read
CREATE POLICY "Staff can read loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
    )
  );
