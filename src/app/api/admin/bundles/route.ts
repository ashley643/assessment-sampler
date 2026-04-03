import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { auth } from '@/lib/auth-config';
import { logAudit } from '@/lib/audit';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('bundles')
    .select(`*, bundle_assessments ( sort_order, assessment_id, assessments ( id, title ) )`)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, title, description, accent_color, badge_bg, badge_text, sort_order, assessment_ids } = body;

  const { data, error } = await supabaseAdmin
    .from('bundles')
    .insert({ id, title, description, accent_color, badge_bg, badge_text, sort_order })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assessment_ids?.length) {
    await supabaseAdmin.from('bundle_assessments').insert(
      assessment_ids.map((aid: string, i: number) => ({
        bundle_id: id,
        assessment_id: aid,
        sort_order: i,
      })),
    );
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'create_bundle',
    entity_type: 'bundle',
    entity_id: title,
    after: { title, assessment_ids },
  });

  return NextResponse.json(data, { status: 201 });
}
