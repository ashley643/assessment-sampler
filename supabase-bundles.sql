-- ============================================================
-- Bundle Architecture Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Bundles table
CREATE TABLE IF NOT EXISTS bundles (
  id text primary key,
  title text not null,
  description text,
  accent_color text default '#4a6fa5',
  badge_bg text default '#e8f0fb',
  badge_text text default '#2d4a7a',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 2. Bundle ↔ assessment membership
CREATE TABLE IF NOT EXISTS bundle_assessments (
  id uuid default gen_random_uuid() primary key,
  bundle_id text references bundles(id) on delete cascade,
  assessment_id text references assessments(id) on delete cascade,
  sort_order int default 0
);

-- 3. Restructure code_assessments to support both assessments and bundles
DO $$
DECLARE
  pk_name text;
BEGIN
  -- 3a. Add bundle_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_assessments' AND column_name = 'bundle_id'
  ) THEN
    ALTER TABLE code_assessments
      ADD COLUMN bundle_id text references bundles(id) on delete cascade;
  END IF;

  -- 3b. Add surrogate id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_assessments' AND column_name = 'id'
  ) THEN
    ALTER TABLE code_assessments
      ADD COLUMN id uuid DEFAULT gen_random_uuid();
    -- Populate id for existing rows
    UPDATE code_assessments SET id = gen_random_uuid() WHERE id IS NULL;
  END IF;

  -- 3c. Drop whatever primary key currently exists (may include assessment_id)
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_name = 'code_assessments' AND constraint_type = 'PRIMARY KEY';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE code_assessments DROP CONSTRAINT %I', pk_name);
  END IF;

  -- 3d. Set new PK on id if not already primary key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'code_assessments' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE code_assessments ADD PRIMARY KEY (id);
  END IF;

  -- 3e. Make assessment_id nullable (it is no longer in a PK)
  ALTER TABLE code_assessments ALTER COLUMN assessment_id DROP NOT NULL;
END $$;

-- 4. Migrate existing lp-group → new bundles table
INSERT INTO bundles (id, title, description, accent_color, badge_bg, badge_text, sort_order)
VALUES ('lp-group', 'Learner Portrait', 'Choose a benchmark to explore the Anchor Attribute Assessment.', '#e8735a', '#FAECE7', '#712B13', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO bundle_assessments (bundle_id, assessment_id, sort_order) VALUES
  ('lp-group', 'lp-b1', 1),
  ('lp-group', 'lp-b2', 2),
  ('lp-group', 'lp-b3', 3),
  ('lp-group', 'lp-b4', 4)
ON CONFLICT DO NOTHING;

-- 5. Move any existing code_assessments rows for lp-group over to bundle_id
UPDATE code_assessments
SET bundle_id = assessment_id, assessment_id = NULL
WHERE assessment_id = 'lp-group';

-- 6. Remove the old lp-group assessment (now replaced by bundles table)
--    Run this only after confirming the migration looks correct:
-- DELETE FROM assessments WHERE id = 'lp-group';
