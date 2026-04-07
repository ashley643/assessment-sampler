CREATE TABLE IF NOT EXISTS videoask_import_configs (
  id              SERIAL PRIMARY KEY,
  form_title      TEXT NOT NULL UNIQUE,
  static_values   JSONB NOT NULL DEFAULT '{}',
  column_mappings JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
