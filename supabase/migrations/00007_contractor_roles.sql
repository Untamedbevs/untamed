-- ============================================
-- Expand contractor roles + add specialty
-- ============================================

-- Drop existing CHECK constraint and replace with expanded role list.
-- Existing 'contractor' rows are migrated to 'contractor_full'.
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;

UPDATE staff SET role = 'contractor_full' WHERE role = 'contractor';

ALTER TABLE staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN ('super_admin', 'admin', 'contractor_full', 'contractor_limited'));

-- Specialty tag for contractors (sales, fulfillment, marketing, etc.)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS contractor_specialty TEXT;

COMMENT ON COLUMN staff.contractor_specialty
  IS 'What the contractor helps with (sales, fulfillment, marketing, production, customer_service, other). Null for internal staff.';

-- ============================================
-- RLS: restrict contractor_limited from sensitive tables
-- ============================================

-- Loyalty members: replace broad staff read with role-filtered read
DROP POLICY IF EXISTS "Staff can read loyalty members" ON loyalty_members;
CREATE POLICY "Non-limited staff can read loyalty members"
  ON loyalty_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- Loyalty receipts: restrict reads
DROP POLICY IF EXISTS "Staff can read loyalty receipts" ON loyalty_receipts;
CREATE POLICY "Non-limited staff can read loyalty receipts"
  ON loyalty_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- Loyalty receipts: restrict updates
DROP POLICY IF EXISTS "Staff can update loyalty receipts" ON loyalty_receipts;
CREATE POLICY "Non-limited staff can update loyalty receipts"
  ON loyalty_receipts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- Loyalty transactions: restrict reads
DROP POLICY IF EXISTS "Staff can read loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Non-limited staff can read loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- Visitors: restrict reads to non-limited
DROP POLICY IF EXISTS "Staff can read visitors" ON visitors;
CREATE POLICY "Non-limited staff can read visitors"
  ON visitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );

-- Sessions: restrict reads to non-limited
DROP POLICY IF EXISTS "Staff can read sessions" ON sessions;
CREATE POLICY "Non-limited staff can read sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
        AND staff.is_active = true
        AND staff.role <> 'contractor_limited'
    )
  );
