-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Adds the audit_log table for admin action tracking

create table if not exists audit_log (
  id          uuid default gen_random_uuid() primary key,
  actor_email text not null,
  action      text not null,       -- e.g. 'create_code', 'update_assessment', 'delete_code'
  entity_type text,                -- e.g. 'access_code', 'assessment', 'question'
  entity_id   text,
  before      jsonb,               -- snapshot before change (null for creates)
  after       jsonb,               -- snapshot after change (null for deletes)
  created_at  timestamptz default now()
);

create index idx_audit_actor   on audit_log(actor_email);
create index idx_audit_created on audit_log(created_at);
create index idx_audit_entity  on audit_log(entity_type, entity_id);
