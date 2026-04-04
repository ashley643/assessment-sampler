import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { auth } from '@/lib/auth-config';
import { logAudit } from '@/lib/audit';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .select(`*, questions ( *, question_samples ( * ) )`)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { title, type, type_label, accent_color, badge_bg, badge_text, description, player_label, sort_order, questions } = body;

  const { error } = await supabaseAdmin
    .from('assessments')
    .update({ title, type, type_label, accent_color, badge_bg, badge_text, description, player_label: player_label || null, sort_order })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (questions !== undefined) {
    type IncomingSample = {
      id?: string; embed_url: string; language: string;
      sort_order: number; gender?: string; grade?: string;
    };
    type IncomingQuestion = {
      id: string; title: string; embed_url: string;
      spanish_embed_url?: string; sort_order: number;
      question_samples?: IncomingSample[];
    };

    const questionRows = (questions as IncomingQuestion[]).map(q => ({
      id: q.id,
      assessment_id: id,
      sort_order: q.sort_order,
      title: q.title,
      embed_url: q.embed_url,
      spanish_embed_url: q.spanish_embed_url ?? null,
    }));

    // Delete questions (cascades to question_samples), then reinsert
    const { error: delErr } = await supabaseAdmin.from('questions').delete().eq('assessment_id', id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (questionRows.length) {
      const { error: insErr } = await supabaseAdmin.from('questions').insert(questionRows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      // Insert question_samples
      const sampleRows = (questions as IncomingQuestion[]).flatMap((q, qi) =>
        (q.question_samples ?? []).filter(s => s.embed_url.trim()).map((s, si) => ({
          question_id: q.id,
          embed_url: s.embed_url.trim(),
          language: s.language,
          sort_order: s.sort_order ?? (qi * 100 + si),
          gender: s.gender?.trim() || null,
          grade: s.grade?.trim() || null,
        }))
      );

      if (sampleRows.length) {
        const { error: sampErr } = await supabaseAdmin.from('question_samples').insert(sampleRows);
        if (sampErr) return NextResponse.json({ error: sampErr.message }, { status: 500 });
      }
    }
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'update_assessment',
    entity_type: 'assessment',
    entity_id: title ?? id,
    after: { title, questions: questions?.length },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin.from('assessments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'delete_assessment',
    entity_type: 'assessment',
    entity_id: id,
  });

  return NextResponse.json({ ok: true });
}
