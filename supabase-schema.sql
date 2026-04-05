-- ─────────────────────────────────────────────────────────────
-- Assessment Sampler — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────

-- Assessments
create table assessments (
  id          text primary key,
  title       text not null,
  type        text not null,
  type_label  text not null,
  accent_color text not null default '#4a6fa5',
  badge_bg    text not null default '#E6F1FB',
  badge_text  text not null default '#0C447C',
  description text,
  question    text,
  sort_order  int  default 0,
  created_at  timestamptz default now()
);

-- Questions
create table questions (
  id              text primary key,
  assessment_id   text references assessments(id) on delete cascade,
  sort_order      int  not null default 0,
  title           text not null,
  embed_url       text not null,
  spanish_embed_url text,
  text_embed_url  text,
  created_at      timestamptz default now()
);

-- Access codes
create table access_codes (
  id          uuid default gen_random_uuid() primary key,
  code        text unique not null,
  label       text not null,
  starts_at   timestamptz default now(),
  expires_at  timestamptz not null,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- Which assessments are enabled per code (ordered)
create table code_assessments (
  code_id       uuid references access_codes(id) on delete cascade,
  assessment_id text references assessments(id) on delete cascade,
  sort_order    int default 0,
  primary key (code_id, assessment_id)
);

-- Analytics: sessions
create table sessions (
  id          uuid default gen_random_uuid() primary key,
  code        text not null,
  started_at  timestamptz default now(),
  last_seen_at timestamptz default now(),
  user_agent  text,
  device_type text
);

-- Analytics: events
create table events (
  id            uuid default gen_random_uuid() primary key,
  session_id    uuid references sessions(id) on delete cascade,
  code          text not null,
  event_type    text not null,
  assessment_id text,
  question_id   text,
  metadata      jsonb,
  created_at    timestamptz default now()
);

-- Indexes
create index idx_events_code    on events(code);
create index idx_events_session on events(session_id);
create index idx_events_created on events(created_at);
create index idx_sessions_code  on sessions(code);

-- ─────────────────────────────────────────────────────────────
-- Seed: existing assessments and SAMPLE2026 code
-- ─────────────────────────────────────────────────────────────

insert into assessments (id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order) values
  ('bhs-2',    'Behavioral Health Screener 2.0',                   'behavioral-health',           'Behavioral Health', '#4a6fa5', '#E6F1FB', '#0C447C', 'A comprehensive screener covering reflective growth, emotional resilience, conflict resolution, and help-seeking behaviors.', 0),
  ('bhs-elem', 'Behavioral Health Screener for Lower Elementary',  'behavioral-health-elementary', 'Lower Elementary',  '#7B68C4', '#EEEDFE', '#3C3489', 'An age-appropriate behavioral health screener designed for younger students, focusing on relational awareness, emotional resilience, and help-seeking.', 1),
  ('lp',       'Learner Portrait',                                 'learner-portrait',             'Learner Portrait',  '#e8735a', '#FAECE7', '#712B13', 'Maps the full learner identity across eight anchor attributes — from curiosity and grit to compassion and gratitude.', 2),
  ('csa',      'Community Schools Assessment',                     'community-schools',            'Community Schools', '#1D9E75', '#E1F5EE', '#085041', 'Evaluates the four pillars of community schools — integrated supports, family engagement, collaborative leadership, and enriched learning time.', 3);

insert into questions (id, assessment_id, sort_order, title, embed_url, spanish_embed_url, text_embed_url) values
  ('bhs2-q1', 'bhs-2', 1, 'Reflective Growth',    'https://flex.impacterpathway.com/fvtnb1z5e', 'https://flex.impacterpathway.com/fklte45t6', 'https://flex.impacterpathway.com/fh5rxsjub'),
  ('bhs2-q2', 'bhs-2', 2, 'Relational Awareness',  'https://flex.impacterpathway.com/fnf4khgtf', 'https://flex.impacterpathway.com/fnn4gs8he', 'https://flex.impacterpathway.com/fnf4khgtf'),
  ('bhs2-q3', 'bhs-2', 3, 'Emotional Resilience',  'https://flex.impacterpathway.com/f3kebc2lk', 'https://flex.impacterpathway.com/fifnpktxs', 'https://flex.impacterpathway.com/fakrud4o4'),
  ('bhs2-q4', 'bhs-2', 4, 'Self-Insight',           'https://flex.impacterpathway.com/f1vvm2aam', 'https://flex.impacterpathway.com/fl1niuvk5',  'https://flex.impacterpathway.com/f3u24ciyu'),
  ('bhs2-q5', 'bhs-2', 5, 'Conflict Resolution',   'https://flex.impacterpathway.com/f94y5l3vy', 'https://flex.impacterpathway.com/fywz1hnys',  'https://flex.impacterpathway.com/frsq2tfbj'),
  ('bhs2-q6', 'bhs-2', 6, 'Effective Help-Seeking', 'https://flex.impacterpathway.com/fh13kktok', 'https://flex.impacterpathway.com/fm22ub4kj',  'https://flex.impacterpathway.com/fjh1jhhcv'),
  ('bhse-q1', 'bhs-elem', 1, 'Relational Awareness',  'https://flex.impacterpathway.com/fjzzdvxk8', 'https://flex.impacterpathway.com/f53lclcrk', null),
  ('bhse-q2', 'bhs-elem', 2, 'Emotional Resilience',  'https://flex.impacterpathway.com/fi4mgwelx',  'https://flex.impacterpathway.com/fj2srdn5v', null),
  ('bhse-q3', 'bhs-elem', 3, 'Effective Help-Seeking', 'https://flex.impacterpathway.com/f96z46iz7', 'https://flex.impacterpathway.com/fgk6ln51z', null),
  ('lp-q1', 'lp', 1, 'Curiosity',           'https://flex.impacterpathway.com/fgl56dog5', null, null),
  ('lp-q2', 'lp', 2, 'Perspective-Taking',  'https://flex.impacterpathway.com/fzs8wcp9n',  null, null),
  ('lp-q3', 'lp', 3, 'Purpose',             'https://flex.impacterpathway.com/fd8l47ysr',  null, null),
  ('lp-q4', 'lp', 4, 'Self-Control',        'https://flex.impacterpathway.com/fjaz0tu7i',  null, null),
  ('lp-q5', 'lp', 5, 'Grit',                'https://flex.impacterpathway.com/f416xj4t7',  null, null),
  ('lp-q6', 'lp', 6, 'Growth Mindset',      'https://flex.impacterpathway.com/fdmgpwqmg',  null, null),
  ('lp-q7', 'lp', 7, 'Compassion',          'https://flex.impacterpathway.com/fks9sqp9g',  null, null),
  ('lp-q8', 'lp', 8, 'Gratitude',           'https://flex.impacterpathway.com/f9n1bhgk0',  null, null),
  ('csa-q1', 'csa', 1, 'Integrated Student Supports',              'https://smfcsd.impacterpathway.com/fruq4wkiw', 'https://smfcsd.impacterpathway.com/ffsu02byw', null),
  ('csa-q2', 'csa', 2, 'Active Family & Community Engagement',     'https://smfcsd.impacterpathway.com/fovwv0ybv', 'https://smfcsd.impacterpathway.com/fsxs3er4s', null),
  ('csa-q3', 'csa', 3, 'Collaborative Leadership & Practice',      'https://smfcsd.impacterpathway.com/f63r7zzuy', 'https://smfcsd.impacterpathway.com/ftxzft3yj', null),
  ('csa-q4', 'csa', 4, 'Expanded & Enriched Learning Time',        'https://smfcsd.impacterpathway.com/fwjpg96dx', 'https://smfcsd.impacterpathway.com/fz0z2h17g', null);

-- Insert SAMPLE2026 code
insert into access_codes (code, label, starts_at, expires_at) values
  ('SAMPLE2026', 'Demo District', now(), '2026-12-31 23:59:59+00');

-- Link all assessments to SAMPLE2026
insert into code_assessments (code_id, assessment_id, sort_order)
select id, 'bhs-2',    0 from access_codes where code = 'SAMPLE2026'
union all
select id, 'bhs-elem', 1 from access_codes where code = 'SAMPLE2026'
union all
select id, 'lp',       2 from access_codes where code = 'SAMPLE2026'
union all
select id, 'csa',      3 from access_codes where code = 'SAMPLE2026';
