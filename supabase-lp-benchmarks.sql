-- ============================================================
-- Learner Portrait Benchmark Assessments
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 4 child benchmark assessments (not assigned directly to access codes)
INSERT INTO assessments (id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order) VALUES
  ('lp-b1', 'Learner Portrait – Benchmark 1', 'learner_portrait', 'Learner Portrait', '#7B68C4', '#EDE9FB', '#5B4DB0', 'Early Elementary (Grades K–2)', 50),
  ('lp-b2', 'Learner Portrait – Benchmark 2', 'learner_portrait', 'Learner Portrait', '#7B68C4', '#EDE9FB', '#5B4DB0', 'Upper Elementary (Grades 3–5)', 51),
  ('lp-b3', 'Learner Portrait – Benchmark 3', 'learner_portrait', 'Learner Portrait', '#7B68C4', '#EDE9FB', '#5B4DB0', 'Middle School (Grades 6–8)', 52),
  ('lp-b4', 'Learner Portrait – Benchmark 4', 'learner_portrait', 'Learner Portrait', '#7B68C4', '#EDE9FB', '#5B4DB0', 'High School (Grades 9–12)', 53);

-- Benchmark 1 questions
INSERT INTO questions (id, assessment_id, sort_order, title, embed_url, spanish_embed_url) VALUES
  ('lp-b1-q1', 'lp-b1', 1, 'Curiosity',         'https://flex.impacterpathway.com/fn0l89pl3', null),
  ('lp-b1-q2', 'lp-b1', 2, 'Perspective-Taking', 'https://flex.impacterpathway.com/fp1skbb2j', null),
  ('lp-b1-q3', 'lp-b1', 3, 'Purpose',            'https://flex.impacterpathway.com/fdmywdcqr', null),
  ('lp-b1-q4', 'lp-b1', 4, 'Self-Control',       'https://flex.impacterpathway.com/fjaz0tu7i', null),
  ('lp-b1-q5', 'lp-b1', 5, 'Grit',               'https://flex.impacterpathway.com/f416xj4t7', null),
  ('lp-b1-q6', 'lp-b1', 6, 'Growth Mindset',     'https://flex.impacterpathway.com/ffcci1sa2', null),
  ('lp-b1-q7', 'lp-b1', 7, 'Compassion',         'https://flex.impacterpathway.com/fxe63vsjt', null),
  ('lp-b1-q8', 'lp-b1', 8, 'Gratitude',          'https://flex.impacterpathway.com/f5ivail46', null);

-- Benchmark 2 questions
INSERT INTO questions (id, assessment_id, sort_order, title, embed_url, spanish_embed_url) VALUES
  ('lp-b2-q1', 'lp-b2', 1, 'Curiosity',         'https://flex.impacterpathway.com/fgl56dog5', null),
  ('lp-b2-q2', 'lp-b2', 2, 'Perspective-Taking', 'https://flex.impacterpathway.com/f6mzg8erv', null),
  ('lp-b2-q3', 'lp-b2', 3, 'Purpose',            'https://flex.impacterpathway.com/fd8l47ysr', null),
  ('lp-b2-q4', 'lp-b2', 4, 'Self-Control',       'https://flex.impacterpathway.com/fu2fo3ab2', null),
  ('lp-b2-q5', 'lp-b2', 5, 'Grit',               'https://flex.impacterpathway.com/f3bk35qnc', null),
  ('lp-b2-q6', 'lp-b2', 6, 'Growth Mindset',     'https://flex.impacterpathway.com/f47kcs9y7', null),
  ('lp-b2-q7', 'lp-b2', 7, 'Compassion',         'https://flex.impacterpathway.com/fks9sqp9g', null),
  ('lp-b2-q8', 'lp-b2', 8, 'Gratitude',          'https://flex.impacterpathway.com/fwenco8vj', null);

-- Benchmark 3 questions
INSERT INTO questions (id, assessment_id, sort_order, title, embed_url, spanish_embed_url) VALUES
  ('lp-b3-q1', 'lp-b3', 1, 'Curiosity',         'https://flex.impacterpathway.com/f6mib0pvg', null),
  ('lp-b3-q2', 'lp-b3', 2, 'Perspective-Taking', 'https://flex.impacterpathway.com/fzs8wcp9n', null),
  ('lp-b3-q3', 'lp-b3', 3, 'Purpose',            'https://flex.impacterpathway.com/fq29xk860', null),
  ('lp-b3-q4', 'lp-b3', 4, 'Self-Control',       'https://flex.impacterpathway.com/fdlit4984', null),
  ('lp-b3-q5', 'lp-b3', 5, 'Grit',               'https://flex.impacterpathway.com/fvax0amv7', null),
  ('lp-b3-q6', 'lp-b3', 6, 'Growth Mindset',     'https://flex.impacterpathway.com/fdmgpwqmg', null),
  ('lp-b3-q7', 'lp-b3', 7, 'Compassion',         'https://flex.impacterpathway.com/fwxzy777r', null),
  ('lp-b3-q8', 'lp-b3', 8, 'Gratitude',          'https://flex.impacterpathway.com/fscc1daa9', null);

-- Benchmark 4 questions
INSERT INTO questions (id, assessment_id, sort_order, title, embed_url, spanish_embed_url) VALUES
  ('lp-b4-q1', 'lp-b4', 1, 'Curiosity',         'https://flex.impacterpathway.com/ftdbvm4tm', null),
  ('lp-b4-q2', 'lp-b4', 2, 'Perspective-Taking', 'https://flex.impacterpathway.com/frw42m3vm', null),
  ('lp-b4-q3', 'lp-b4', 3, 'Purpose',            'https://flex.impacterpathway.com/fv89a32ua', null),
  ('lp-b4-q4', 'lp-b4', 4, 'Self-Control',       'https://flex.impacterpathway.com/fmmamlma8', null),
  ('lp-b4-q5', 'lp-b4', 5, 'Grit',               'https://flex.impacterpathway.com/fbs1zxlaq', null),
  ('lp-b4-q6', 'lp-b4', 6, 'Growth Mindset',     'https://flex.impacterpathway.com/f0sbo6ieu', null),
  ('lp-b4-q7', 'lp-b4', 7, 'Compassion',         'https://flex.impacterpathway.com/fvb86pppe', null),
  ('lp-b4-q8', 'lp-b4', 8, 'Gratitude',          'https://flex.impacterpathway.com/f9n1bhgk0', null);

-- Parent benchmark group assessment (this is what you assign to access codes)
INSERT INTO assessments (id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order) VALUES
  ('lp-group', 'Learner Portrait', 'benchmark_group', 'Learner Portrait', '#7B68C4', '#EDE9FB', '#5B4DB0', 'Choose a benchmark to explore the Anchor Attribute Assessment.', 10);

-- Selector entries for the group: id = child assessment id, embed_url = first question preview
INSERT INTO questions (id, assessment_id, sort_order, title, embed_url, spanish_embed_url) VALUES
  ('lp-b1', 'lp-group', 1, 'Benchmark 1', 'https://flex.impacterpathway.com/fn0l89pl3', null),
  ('lp-b2', 'lp-group', 2, 'Benchmark 2', 'https://flex.impacterpathway.com/fgl56dog5', null),
  ('lp-b3', 'lp-group', 3, 'Benchmark 3', 'https://flex.impacterpathway.com/f6mib0pvg', null),
  ('lp-b4', 'lp-group', 4, 'Benchmark 4', 'https://flex.impacterpathway.com/ftdbvm4tm', null);
