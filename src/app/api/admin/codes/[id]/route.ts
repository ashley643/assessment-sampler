import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('access_codes')
    .select(`*, code_assessments ( sort_order, assessment_id, assessments ( * ) )`)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { label, starts_at, expires_at, is_active, assessment_ids } = body;

  const { error } = await supabaseAdmin
    .from('access_codes')
    .update({ label, starts_at, expires_at, is_active })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync assessments
  if (assessment_ids !== undefined) {
    await supabaseAdmin.from('code_assessments').delete().eq('code_id', id);
    if (assessment_ids.length) {
      await supabaseAdmin.from('code_assessments').insert(
        assessment_ids.map((aid: string, i: number) => ({
          code_id: id,
          assessment_id: aid,
          sort_order: i,
        })),
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin.from('access_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
