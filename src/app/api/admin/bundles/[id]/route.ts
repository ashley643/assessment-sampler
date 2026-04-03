import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { auth } from '@/lib/auth-config';
import { logAudit } from '@/lib/audit';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('bundles')
    .select(`*, bundle_assessments ( sort_order, assessment_id, assessments ( id, title, type_label, accent_color ) )`)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { title, description, accent_color, badge_bg, badge_text, sort_order, assessment_ids } = body;

  const { error } = await supabaseAdmin
    .from('bundles')
    .update({ title, description, accent_color, badge_bg, badge_text, sort_order })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assessment_ids !== undefined) {
    await supabaseAdmin.from('bundle_assessments').delete().eq('bundle_id', id);
    if (assessment_ids.length) {
      await supabaseAdmin.from('bundle_assessments').insert(
        assessment_ids.map((aid: string, i: number) => ({
          bundle_id: id,
          assessment_id: aid,
          sort_order: i,
        })),
      );
    }
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'update_bundle',
    entity_type: 'bundle',
    entity_id: title ?? id,
    after: { title, assessment_ids },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin.from('bundles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'delete_bundle',
    entity_type: 'bundle',
    entity_id: id,
  });

  return NextResponse.json({ ok: true });
}
