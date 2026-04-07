import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = { select: (...a: any[]) => any; in: (...a: any[]) => any; eq: (...a: any[]) => any; limit: (...a: any[]) => any; ilike: (...a: any[]) => any; not: (...a: any[]) => any };
type FlexClient = { from: (t: string) => AnyQuery };

export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'search';

  const db = getImpacterClient() as unknown as FlexClient;

  // ── SIDEBAR mode ──────────────────────────────────────────────────────────
  if (mode === 'sidebar') {
    // Get pilot stats (includes district_name)
    const { data: statsData, error: statsErr } = await db.from('v_pilot_stats')
      .select('pilot_id, pilot_name, district_name, total_va_submissions');

    if (statsErr) {
      console.error('v_pilot_stats error:', statsErr);
      return NextResponse.json({ error: statsErr.message }, { status: 500 });
    }

    type StatRow = { pilot_id: string; pilot_name: string; district_name: string; total_va_submissions: number };
    const stats = (statsData ?? []) as StatRow[];

    // Get distinct (pilot_id, school_name) pairs from responses
    const { data: responsesData, error: respErr } = await db.from('responses')
      .select('pilot_id, school_name')
      .limit(5000);

    if (respErr) {
      console.error('responses error:', respErr);
      return NextResponse.json({ error: respErr.message }, { status: 500 });
    }

    type RespRow = { pilot_id: string; school_name: string };
    const responses = (responsesData ?? []) as RespRow[];

    // Deduplicate schools by pilot_id in JS
    const schoolsByPilot: Record<string, Set<string>> = {};
    for (const r of responses) {
      if (!r.pilot_id) continue;
      if (!schoolsByPilot[r.pilot_id]) schoolsByPilot[r.pilot_id] = new Set();
      if (r.school_name) schoolsByPilot[r.pilot_id].add(r.school_name);
    }

    // Build district → pilots tree
    const districtMap: Record<string, { name: string; pilots: { id: string; name: string; schools: string[]; totalSubmissions: number }[] }> = {};

    for (const s of stats) {
      const dName = s.district_name ?? 'Unknown District';
      if (!districtMap[dName]) districtMap[dName] = { name: dName, pilots: [] };
      districtMap[dName].pilots.push({
        id: s.pilot_id,
        name: s.pilot_name ?? 'Unknown Pilot',
        schools: Array.from(schoolsByPilot[s.pilot_id] ?? []).sort(),
        totalSubmissions: s.total_va_submissions ?? 0,
      });
    }

    const districts = Object.values(districtMap).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ districts });
  }

  // ── SEARCH mode (default) ─────────────────────────────────────────────────
  const pilotIdsParam = searchParams.get('pilotIds') ?? '';
  const school        = searchParams.get('school') ?? '';
  const grade         = searchParams.get('grade') ?? '';
  const language      = searchParams.get('language') ?? '';
  const mediaTypeParam = searchParams.get('mediaType') ?? '';
  const promptTitle   = searchParams.get('promptTitle') ?? '';
  const search        = searchParams.get('search') ?? '';
  const minWords      = parseInt(searchParams.get('minWords') ?? '15');
  const page          = parseInt(searchParams.get('page') ?? '1');
  const limit         = 24;
  const offset        = (page - 1) * limit;

  if (!pilotIdsParam.trim()) {
    return NextResponse.json({ transcripts: [], totalCount: 0, hasMore: false, filterOptions: { grades: [], genders: [], languages: [], promptTitles: [] } });
  }

  const pilotIds = pilotIdsParam.split(',').map(s => s.trim()).filter(Boolean);

  // Step 1: get matching response IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let responseQuery: any = db.from('responses')
    .select('id, school_name, grade_level, gender, pilot_id')
    .in('pilot_id', pilotIds);

  if (school) responseQuery = responseQuery.eq('school_name', school);
  if (grade)  responseQuery = responseQuery.eq('grade_level', grade);

  const { data: responsesData, error: respErr } = await responseQuery.limit(5000);

  if (respErr) {
    console.error('responses query error:', respErr);
    return NextResponse.json({ error: respErr.message }, { status: 500 });
  }

  type ResponseRow = { id: string; school_name: string; grade_level: string; gender: string | null; pilot_id: string };
  const matchedResponses = (responsesData ?? []) as ResponseRow[];
  const responseIds = matchedResponses.map(r => r.id);

  if (responseIds.length === 0) {
    return NextResponse.json({ transcripts: [], totalCount: 0, hasMore: false, filterOptions: { grades: [], genders: [], languages: [], promptTitles: [] } });
  }

  // Build lookup map for response metadata
  const responseMeta: Record<string, ResponseRow> = {};
  for (const r of matchedResponses) responseMeta[r.id] = r;

  // Step 2: get answers for those response IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let answersQuery: any = db.from('answers')
    .select('id, response_id, prompt_index, prompt_title, media_type, media_url, share_url, thumbnail_url, transcript, detected_language, created_at')
    .in('response_id', responseIds)
    .not('transcript', 'is', null)
    .neq('transcript', '');

  if (mediaTypeParam === 'audio') answersQuery = answersQuery.eq('media_type', 'audio');
  if (mediaTypeParam === 'video') answersQuery = answersQuery.eq('media_type', 'video');
  if (language)    answersQuery = answersQuery.eq('detected_language', language);
  if (promptTitle) answersQuery = answersQuery.eq('prompt_title', promptTitle);
  if (search)      answersQuery = answersQuery.ilike('transcript', `%${search}%`);

  const { data: answersData, error: answersErr } = await answersQuery.limit(2000);

  if (answersErr) {
    console.error('answers query error:', answersErr);
    return NextResponse.json({ error: answersErr.message }, { status: 500 });
  }

  type AnswerRow = {
    id: string;
    response_id: string;
    prompt_index: number;
    prompt_title: string | null;
    media_type: string | null;
    media_url: string | null;
    share_url: string | null;
    thumbnail_url: string | null;
    transcript: string;
    detected_language: string | null;
    created_at: string;
  };

  const allAnswers = (answersData ?? []) as AnswerRow[];

  // Collect filterOptions from the full result set (before pagination/word-count filter)
  const gradesSet    = new Set<string>();
  const gendersSet   = new Set<string>();
  const languagesSet = new Set<string>();
  const titlesSet    = new Set<string>();

  for (const a of allAnswers) {
    const resp = responseMeta[a.response_id];
    if (resp?.grade_level) gradesSet.add(resp.grade_level);
    if (resp?.gender)      gendersSet.add(resp.gender);
    if (a.detected_language) languagesSet.add(a.detected_language);
    if (a.prompt_title)    titlesSet.add(a.prompt_title);
  }

  // Filter by min words + build normalized cards
  type AnswerCard = {
    id: string;
    responseId: string;
    promptTitle: string;
    promptIndex: number;
    mediaType: 'video' | 'audio';
    mediaUrl: string | null;
    shareUrl: string | null;
    thumbnailUrl: string | null;
    transcript: string;
    language: string | null;
    schoolName: string;
    gradeLevel: string;
    gender: string | null;
    pilotId: string;
    wordCount: number;
    createdAt: string;
  };

  const normalized: AnswerCard[] = [];
  for (const a of allAnswers) {
    const resp = responseMeta[a.response_id];
    if (!resp) continue;
    const text = a.transcript ?? '';
    const wc = text.trim().split(/\s+/).filter(Boolean).length;
    if (wc < minWords) continue;

    const rawMedia = (a.media_type ?? '').toLowerCase();
    const mediaUrl = a.media_url ?? null;
    const urlExt = (mediaUrl ?? '').toLowerCase().split('?')[0].split('.').pop() ?? '';
    const mediaT: 'video' | 'audio' =
      rawMedia === 'audio' || urlExt === 'mp3' || urlExt === 'ogg' || urlExt === 'm4a' ? 'audio' : 'video';

    normalized.push({
      id:           a.id,
      responseId:   a.response_id,
      promptTitle:  a.prompt_title ?? '',
      promptIndex:  a.prompt_index ?? 0,
      mediaType:    mediaT,
      mediaUrl,
      shareUrl:     a.share_url ?? null,
      thumbnailUrl: a.thumbnail_url ?? null,
      transcript:   text,
      language:     a.detected_language ?? null,
      schoolName:   resp.school_name ?? '',
      gradeLevel:   resp.grade_level ?? '',
      gender:       resp.gender ?? null,
      pilotId:      resp.pilot_id,
      wordCount:    wc,
      createdAt:    a.created_at,
    });
  }

  const totalCount = normalized.length;
  const paginated  = normalized.slice(offset, offset + limit);
  const hasMore    = totalCount > offset + limit;

  return NextResponse.json({
    transcripts: paginated,
    totalCount,
    hasMore,
    page,
    filterOptions: {
      grades:       Array.from(gradesSet).sort(),
      genders:      Array.from(gendersSet).sort(),
      languages:    Array.from(languagesSet).sort(),
      promptTitles: Array.from(titlesSet).sort(),
    },
  });
}
