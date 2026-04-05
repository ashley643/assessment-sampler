import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { auth } from '@/lib/auth-config';
import { logAudit } from '@/lib/audit';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .select(`*, questions ( * )`)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, title, type, type_label, accent_color, badge_bg, badge_text, description, player_label, sort_order } = body;

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .insert({ id, title, type, type_label, accent_color, badge_bg, badge_text, description, player_label: player_label || null, sort_order })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type IncomingSample = {
    id?: string; embed_url: string; language: string; media_type?: string;
    sort_order: number; gender?: string; grade?: string; excerpt?: string;
  };
  type IncomingQuestion = {
    id: string; title: string; sort_order: number;
    embed_url: string; spanish_embed_url?: string;
    question_samples?: IncomingSample[];
  };

  if (body.questions?.length) {
    const questions: IncomingQuestion[] = body.questions;

    const { error: qErr } = await supabaseAdmin.from('questions').insert(
      questions.map(q => ({
        id: q.id,
        assessment_id: id,
        sort_order: q.sort_order,
        title: q.title,
        embed_url: q.embed_url,
        spanish_embed_url: q.spanish_embed_url || null,
      }))
    );
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    const sampleRows = questions.flatMap((q, qi) =>
      (q.question_samples ?? []).filter(s => s.embed_url?.trim()).map((s, si) => ({
        question_id: q.id,
        embed_url: s.embed_url.trim(),
        language: s.language,
        media_type: s.media_type || 'video',
        sort_order: s.sort_order ?? (qi * 100 + si),
        gender: s.gender?.trim() || null,
        grade: s.grade?.trim() || null,
        excerpt: s.excerpt?.trim() || null,
      }))
    );

    if (sampleRows.length) {
      const { error: sErr } = await supabaseAdmin.from('question_samples').insert(sampleRows);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
  }

  const session = await auth();
  await logAudit({
    actor_email: session?.user?.email ?? 'unknown',
    action: 'create_assessment',
    entity_type: 'assessment',
    entity_id: title,
    after: { title, type_label, questions: body.questions?.length ?? 0 },
  });

  return NextResponse.json(data, { status: 201 });
}
