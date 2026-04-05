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
  const mustParam = searchParams.get('must') ?? '';
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

  const allRows = ((assessmentsData ?? []) as ARow[]).flatMap(a =>
    (a.questions ?? []).map(q => {
      const langs     = (q.question_samples ?? []).map(s => s.language);
      const missingEn = !langs.includes('english');
      const missingEs = !langs.includes('spanish');
      return { questionId: q.id, questionTitle: q.title, questionText: q.question ?? '', assessmentId: a.id, assessmentTitle: a.title, typeLabel: a.type_label, missingEn, missingEs };
    })
  );

  const needsSamples = allRows.filter(q => q.missingEn || q.missingEs);
  const allQuestions = allRows; // full list including fully-stocked questions

  // Load all existing embed_urls so the UI can flag already-assigned transcripts
  const { data: assignedData } = await supabaseAdmin
    .from('question_samples')
    .select('embed_url, question_id');

  // Build a map: normalised embed_url (no query string) → { questionId, questionTitle }
  const questionTitleById = Object.fromEntries(
    ((assessmentsData ?? []) as ARow[]).flatMap(a =>
      (a.questions ?? []).map(q => [q.id, q.title])
    )
  );
  const assignedUrls: { embedUrl: string; normalised: string; questionId: string; questionTitle: string }[] =
    (assignedData ?? []).map(r => ({
      embedUrl:    r.embed_url as string,
      normalised:  (r.embed_url as string ?? '').split('?')[0],
      questionId:  r.question_id as string,
      questionTitle: questionTitleById[r.question_id as string] ?? 'Unknown',
    }));

  // If only the needs list was requested, return early
  if (needsOnly || (!search.trim() && !mustParam.trim())) {
    return NextResponse.json({ transcripts: [], needsSamples, allQuestions, assignedUrls, page: 1, hasMore: false });
  }

  const impacter = getImpacterClient();

  const keywords     = search.trim().split(/\s+/).filter(Boolean);
  const mustKeywords = mustParam.trim() ? mustParam.trim().split(/\s+/).filter(Boolean) : [];

  // Helper: apply shared filters to any query on this table
  function applyFilters<T>(q: T): T {
    let qq = (q as unknown as ReturnType<typeof impacter.schema>['from']) as typeof q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qq = (qq as unknown as { not: (col: string, op: string, val: any) => typeof qq }).not('transcript', 'is', null) as typeof q;
    qq = (qq as unknown as { neq: (col: string, val: string) => typeof qq }).neq('transcript', '') as typeof q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qq = (qq as unknown as { not: (col: string, op: string, val: any) => typeof qq }).not('media_url', 'is', null) as typeof q;
    // Always exclude non-response VideoAsk nodes
    qq = (qq as unknown as { not: (col: string, op: string, val: string) => typeof qq }).not('node_title', 'ilike', '%Hi! Thanks for applying%') as typeof q;
    qq = (qq as unknown as { not: (col: string, op: string, val: string) => typeof qq }).not('node_title', 'ilike', '%real student response%') as typeof q;
    if (mediaType === 'audio') qq = (qq as unknown as { ilike: (col: string, val: string) => typeof qq }).ilike('media_url', '%audio.mp3%') as typeof q;
    if (mediaType === 'video') qq = (qq as unknown as { not: (col: string, op: string, val: string) => typeof qq }).not('media_url', 'ilike', '%audio.mp3%') as typeof q;
    if (keywords.length > 0) {
      const conditions = keywords.flatMap(k => [`transcript.ilike.%${k}%`, `node_title.ilike.%${k}%`]).join(',');
      qq = (qq as unknown as { or: (cond: string) => typeof qq }).or(conditions) as typeof q;
    }
    // Must-have keywords: each chained separately so they AND together
    for (const kw of mustKeywords) {
      qq = (qq as unknown as { or: (cond: string) => typeof qq }).or(`transcript.ilike.%${kw}%,node_title.ilike.%${kw}%`) as typeof q;
    }
    return qq;
  }

  const baseQuery = () => impacter.schema('videoask').from('steps');

  // ── 1. Total count ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countQ = applyFilters(baseQuery().select('*', { count: 'exact', head: true } as any));
  const { count: totalCount } = await countQ;

  // ── 2. All matching node_titles (for Questions Asked filter, full search) ─
  const nodeTitleQ = applyFilters(baseQuery().select('node_title'));
  const { data: nodeTitleData } = await nodeTitleQ;
  const allNodeTitles: { title: string; count: number }[] = Object.entries(
    (nodeTitleData ?? []).reduce<Record<string, number>>((acc, r) => {
      const t = String((r as Record<string,unknown>).node_title ?? '');
      if (t) acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count);

  // ── 3. Paginated data — fetch 3× page for relevance sorting ────────────
  const fetchLimit = limit * 3;
  const dataQ = applyFilters(
    baseQuery().select('*').order('created_at', { ascending: false }).range(offset, offset + fetchLimit - 1)
  );
  const { data: stepsData, error: stepsErr } = await dataQ;

  if (stepsErr) {
    console.error('VideoAsk steps error:', stepsErr);
    return NextResponse.json({ error: stepsErr.message, transcripts: [], needsSamples: [], page, hasMore: false });
  }

  function normalize(s: Record<string, unknown>) {
    const text    = String(s.transcript ?? '');
    const wc      = text.trim().split(/\s+/).filter(Boolean).length;
    const rawMedia = String(s.media_type ?? '').toLowerCase();
    const mediaUrl = String(s.media_url ?? '');
    const urlExt   = mediaUrl.toLowerCase().split('?')[0].split('.').pop() ?? '';
    const mediaT: 'video' | 'audio' =
      rawMedia.includes('audio') || urlExt === 'mp3' || urlExt === 'ogg' || urlExt === 'm4a'
        ? 'audio' : 'video';
    return {
      id:        String(s.id ?? ''),
      nodeTitle: String(s.node_title ?? ''),
      transcript: text,
      mediaType: mediaT,
      mediaUrl,
      shareUrl:  s.share_url ? String(s.share_url) : null,
      grade:     (s.grade ?? s.grade_level ?? s.variables_grade ?? null) as string | null,
      gender:    (s.gender ?? s.variables_gender ?? null) as string | null,
      school:    (s.school_name ?? s.school ?? null) as string | null,
      formTitle: (s.form_title ?? null) as string | null,
      wordCount: wc,
      createdAt: String(s.created_at ?? ''),
    };
  }

  // ── 4. Score by keyword hit count, sort best first ──────────────────────
  function scoreRow(t: ReturnType<typeof normalize>): number {
    const haystack = (t.transcript + ' ' + t.nodeTitle).toLowerCase();
    const allKws = [...keywords, ...mustKeywords];
    return allKws.reduce((s, kw) => {
      const needle = kw.toLowerCase();
      let count = 0, pos = 0;
      while ((pos = haystack.indexOf(needle, pos)) !== -1) { count++; pos++; }
      return s + count;
    }, 0);
  }

  const transcripts = (stepsData ?? [])
    .map(normalize)
    .filter(t => t.wordCount >= minWords)
    .map(t => ({ ...t, _score: scoreRow(t) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score: _, ...rest }) => rest);

  const hasMore = (totalCount ?? 0) > offset + limit;

  return NextResponse.json({ transcripts, totalCount: totalCount ?? 0, allNodeTitles, needsSamples, allQuestions, assignedUrls, page, hasMore });
}
