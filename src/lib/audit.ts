import { getSupabaseAdmin } from './supabase-admin';

export async function logAudit({
  actor_email,
  action,
  entity_type,
  entity_id,
  before,
  after,
}: {
  actor_email: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  try {
    await getSupabaseAdmin().from('audit_log').insert({
      actor_email,
      action,
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      before: before ?? null,
      after: after ?? null,
    });
  } catch {
    // Audit failures are non-fatal
  }
}
