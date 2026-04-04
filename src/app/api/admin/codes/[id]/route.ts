import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { auth } from '@/lib/auth-config';
import { logAudit } from '@/lib/audit';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('access_codes')
    .select(`*, code_assignments ( sort_order, assessment_id, bundle_id, assessments ( * ), bundles ( * ) )`)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { label, starts_at, expires_at, is_active, assessment_ids, bundle_ids } = body;

  // Snapshot before
  const { data: before } = await supabaseAdmin.from('access_codes').select('*').eq('id', id).single();

  const { error } = await supabaseAdmin
    .from('access_codes')
    .update({ label, starts_at, expires_at, is_active })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assessment_ids !== undefined || bundle_ids !== undefined) {
    await supabaseAdmin.from('code_assignments').delete().eq('code_id', id);
    const rows: { code_id: string; assessment_id?: string; bundle_id?: string; sort_order: number }[] = [];
    let i = 0;
    for (const bid of (bundle_ids ?? [])) {
      rows.push({ code_id: id, bundle_id: bid, sort_order: i++ });
    }
    for (const aid of (assessment_ids ?? [])) {
      rows.push({ code_id: id, assessment_id: aid, sort_order: i++ });
    }
    if (rows.length) {
      await supabaseAdmin.from('code_assignments').insert(rows);
    }
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'update_code',
    entity_type: 'access_code',
    entity_id: id,
    before: before ?? undefined,
    after: { label, starts_at, expires_at, is_active, assessment_ids, bundle_ids },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data: before } = await supabaseAdmin.from('access_codes').select('*').eq('id', id).single();
  const { error } = await supabaseAdmin.from('access_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'delete_code',
    entity_type: 'access_code',
    entity_id: id,
    before: before ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
