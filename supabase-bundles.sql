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

-- 3. Recreate code_assessments with nullable assessment_id + bundle_id support
--    (safer than ALTER on a composite PK table)
CREATE TABLE IF NOT EXISTS code_assessments_new (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id uuid REFERENCES access_codes(id) ON DELETE CASCADE,
  assessment_id text REFERENCES assessments(id) ON DELETE CASCADE,
  bundle_id text REFERENCES bundles(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0
);

INSERT INTO code_assessments_new (code_id, assessment_id, sort_order)
SELECT code_id, assessment_id, sort_order FROM code_assessments;

DROP TABLE code_assessments;
ALTER TABLE code_assessments_new RENAME TO code_assessments;

-- 4. Migrate lp-group into bundles
INSERT INTO bundles (id, title, description, accent_color, badge_bg, badge_text, sort_order)
VALUES ('lp-group', 'Learner Portrait', 'Choose a benchmark to explore the Anchor Attribute Assessment.', '#e8735a', '#FAECE7', '#712B13', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO bundle_assessments (bundle_id, assessment_id, sort_order) VALUES
  ('lp-group', 'lp-b1', 1),
  ('lp-group', 'lp-b2', 2),
  ('lp-group', 'lp-b3', 3),
  ('lp-group', 'lp-b4', 4)
ON CONFLICT DO NOTHING;

-- 5. Move lp-group code_assessments rows to use bundle_id
UPDATE code_assessments
SET bundle_id = assessment_id, assessment_id = NULL
WHERE assessment_id = 'lp-group';

-- 6. Cleanup (run after confirming everything works):
-- DELETE FROM assessments WHERE id = 'lp-group';
