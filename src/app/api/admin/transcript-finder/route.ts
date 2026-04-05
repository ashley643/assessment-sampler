import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getImpacterClient } from '@/lib/impacter-client';

export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const needsOnly = searchParams.get('needsOnly') === 'true';
  const mediaType = searchParams.get('mediaType');
  const minWords  = parseInt(searchParams.get('minWords') ?? '40');
  const search    = searchParams.get('search') ?? '';
  const page      = parseInt(searchParams.get('page') ?? '1');
  const limit     = 24;
  const offset    = (page - 1) * limit;

  // ── Questions that need samples (always returned) ───────────────────────
  const { data: assessmentsData } = await supabaseAdmin
    .from('assessments')
    .select('id, title, type_label, questions ( id, title, question, question_samples ( id, language ) )')
    .neq('type', 'bundle')
    .order('sort_order');

  type QSample = { id: string; language: string };
  type QRow    = { id: string; title: string; question: string | null; question_samples: QSample[] };
  type ARow    = { id: string; title: string; type_label: string; questions: QRow[] };

  const needsSamples = ((assessmentsData ?? []) as ARow[]).flatMap(a =>
    (a.questions ?? [])
      .map(q => {
        const langs     = (q.question_samples ?? []).map(s => s.language);
        const missingEn = !langs.includes('english');
        const missingEs = !langs.includes('spanish');
        return { questionId: q.id, questionTitle: q.title, questionText: q.question ?? '', assessmentId: a.id, assessmentTitle: a.title, typeLabel: a.type_label, missingEn, missingEs };
      })
      .filter(q => q.missingEn || q.missingEs)
  );

  // If only the needs list was requested, return early
  if (needsOnly || !search.trim()) {
    return NextResponse.json({ transcripts: [], needsSamples, page: 1, hasMore: false });
  }

  const impacter = getImpacterClient();

  // ── Fetch transcript steps from VideoAsk ─────────────────────────────────
  // Columns known from VideoAsk API docs: node_title, transcript, media_type, media_url, created_at
  // We query the videoask schema using the schema() client
  let stepsQuery = impacter
    .schema('videoask')
    .from('steps')
    .select('*')
    .not('transcript', 'is', null)
    .neq('transcript', '')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (mediaType) {
    stepsQuery = stepsQuery.ilike('media_type', mediaType);
  } else {
    // only video and audio, not text/other
    stepsQuery = stepsQuery.or('media_type.ilike.video,media_type.ilike.audio,media_type.ilike.*video*,media_type.ilike.*audio*');
  }

  if (search) {
    stepsQuery = stepsQuery.or(`transcript.ilike.%${search}%,node_title.ilike.%${search}%`);
  }

  const { data: stepsData, error: stepsErr } = await stepsQuery;

  if (stepsErr) {
    console.error('VideoAsk steps error:', stepsErr);
    return NextResponse.json({ error: stepsErr.message, transcripts: [], needsSamples: [], page, hasMore: false });
  }

  // Filter by word count and normalize
  const transcripts = (stepsData ?? [])
    .map((s: Record<string, unknown>) => {
      const text      = String(s.transcript ?? '');
      const wc        = text.trim().split(/\s+/).filter(Boolean).length;
      const rawMedia  = String(s.media_type ?? '').toLowerCase();
      const mediaT: 'video' | 'audio' = rawMedia.includes('audio') ? 'audio' : 'video';

      return {
        id:        String(s.id ?? ''),
        nodeTitle: String(s.node_title ?? ''),
        transcript: text,
        mediaType: mediaT,
        mediaUrl:  String(s.media_url ?? ''),
        // grade/gender may come from columns if they exist, or from a joined contact
        grade:     (s.grade ?? s.grade_level ?? s.variables_grade ?? null) as string | null,
        gender:    (s.gender ?? s.variables_gender ?? null) as string | null,
        school:    (s.school_name ?? s.school ?? null) as string | null,
        formTitle: (s.form_title ?? null) as string | null,
        wordCount: wc,
        createdAt: String(s.created_at ?? ''),
        // expose all raw keys on first page so we can see the schema
        _rawKeys: page === 1 ? Object.keys(s) : undefined,
      };
    })
    .filter(t => t.wordCount >= minWords);

  return NextResponse.json({ transcripts, needsSamples, page, hasMore: (stepsData?.length ?? 0) === limit });
}
