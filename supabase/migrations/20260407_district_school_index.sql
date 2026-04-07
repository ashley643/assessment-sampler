-- District/school index table
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- This caches the district+school list so the District Finder sidebar loads instantly
-- instead of paginating through 194k rows of student_responses.

CREATE TABLE IF NOT EXISTS district_school_index (
  id            SERIAL PRIMARY KEY,
  district_name TEXT NOT NULL,
  school_name   TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (district_name, school_name)
);
