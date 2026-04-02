import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

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
  const { code, label, starts_at, expires_at, assessment_ids } = body;

  const { data: newCode, error } = await supabaseAdmin
    .from('access_codes')
    .insert({ code: code.trim().toUpperCase(), label, starts_at, expires_at })
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

  return NextResponse.json(newCode, { status: 201 });
}
