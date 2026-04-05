import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { auth } from '@/lib/auth-config';
import { logAudit } from '@/lib/audit';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('access_codes')
    .select(`
      *,
      code_assignments (
        sort_order,
        assessment_id,
        bundle_id,
        assessments ( id, title, type_label ),
        bundles ( id, title )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { code, label, starts_at, expires_at, assessment_ids, bundle_ids, is_active, can_view_samples } = body;

  const { data: newCode, error } = await supabaseAdmin
    .from('access_codes')
    .insert({ code: code.trim().toUpperCase(), label, starts_at, expires_at, is_active: is_active ?? true, can_view_samples: can_view_samples ?? true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: { code_id: string; assessment_id?: string; bundle_id?: string; sort_order: number }[] = [];
  let i = 0;
  if (bundle_ids?.length) {
    for (const bid of bundle_ids) {
      rows.push({ code_id: newCode.id, bundle_id: bid, sort_order: i++ });
    }
  }
  if (assessment_ids?.length) {
    for (const aid of assessment_ids) {
      rows.push({ code_id: newCode.id, assessment_id: aid, sort_order: i++ });
    }
  }
  if (rows.length) {
    await supabaseAdmin.from('code_assignments').insert(rows);
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'create_code',
    entity_type: 'access_code',
    entity_id: newCode.id,
    after: { code: newCode.code, label, assessment_ids, bundle_ids },
  });

  return NextResponse.json(newCode, { status: 201 });
}
