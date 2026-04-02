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
      code_assessments (
        sort_order,
        assessment_id,
        assessments ( id, title, type_label )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { code, label, starts_at, expires_at, assessment_ids, is_active } = body;

  const { data: newCode, error } = await supabaseAdmin
    .from('access_codes')
    .insert({ code: code.trim().toUpperCase(), label, starts_at, expires_at, is_active: is_active ?? true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assessment_ids?.length) {
    await supabaseAdmin.from('code_assessments').insert(
      assessment_ids.map((id: string, i: number) => ({
        code_id: newCode.id,
        assessment_id: id,
        sort_order: i,
      })),
    );
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'create_code',
    entity_type: 'access_code',
    entity_id: newCode.id,
    after: { code: newCode.code, label, assessment_ids },
  });

  return NextResponse.json(newCode, { status: 201 });
}
