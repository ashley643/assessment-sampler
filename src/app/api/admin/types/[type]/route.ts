import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

type Ctx = { params: Promise<{ type: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await ctx.params;
  const body = await req.json();
  const { type: newType, type_label, accent_color, badge_bg, badge_text } = body;

  const { error } = await supabaseAdmin
    .from('assessments')
    .update({ type: newType, type_label, accent_color, badge_bg, badge_text })
    .eq('type', decodeURIComponent(type));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await ctx.params;

  // Find assessment IDs so we can delete questions first (cascade may handle it, but be safe)
  const { data: assessments } = await supabaseAdmin
    .from('assessments')
    .select('id')
    .eq('type', decodeURIComponent(type));

  if (assessments?.length) {
    const ids = assessments.map(a => a.id);
    await supabaseAdmin.from('questions').delete().in('assessment_id', ids);
    await supabaseAdmin.from('assessments').delete().in('id', ids);
  }

  return NextResponse.json({ ok: true });
}
