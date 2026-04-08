import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function extractUuid(url: string): string | null {
  const m = url.match(/transcoded\/([0-9a-f-]{36})\//i);
  return m ? m[1] : null;
}

function wordCount(text: string | null): number {
  if (!text) return 0;
  return text.replace(/^"|"$/g, '').trim().split(/\s+/).filter(Boolean).length;
}

export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'search';
  const db = getImpacterClient() as unknown as DB;

  // ── SIDEBAR ───────────────────────────────────────────────────────────────
  if (mode === 'sidebar') {
    type Row = { district_name: string | null; school_name: string | null };
    const districtMap: Record<string, Set<string>> = {};
    const PAGE = 1000;
    let from = 0;
    let keepGoing = true;

    while (keepGoing) {
      const { data, error } = await db
        .from('student_responses')
        .select('district_name, school_name')
        .order('district_name', { ascending: true })
        .order('school_name',   { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const rows = (data ?? []) as Row[];
      for (const r of rows) {
        const d = r.district_name ?? 'Unknown District';
        if (!districtMap[d]) districtMap[d] = new Set();
        if (r.school_name) districtMap[d].add(r.school_name);
      }

      keepGoing = rows.length === PAGE && from < 200000;
      from += PAGE;
    }

    const districts = Object.entries(districtMap)
      .map(([name, schools]) => ({ name, schools: Array.from(schools).sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ districts });
  }

  // ── EXPORT CSV ────────────────────────────────────────────────────────────
  if (mode === 'export') {
    const districtName = searchParams.get('district') ?? '';
    const schoolName   = searchParams.get('school')   ?? '';
    if (!districtName) return NextResponse.json({ error: 'district required' }, { status: 400 });

    const NO_DISTRICT_EXPORT = '(No District)';

    let q = db
      .from('student_responses')
      .select('id, district_name, school_name, class_name, teacher_name, first_name, last_name, student_email, current_grade, gender, ethnicity, home_language, hispanic, ell, frl, iep, session_name, course_id, response_type, question_num, question, answer, harvard_attribute, harvard_score, harvard_impacter_score, casel_attribute, casel_score, casel_impacter_score, url, answer_date, source_id');

    if (districtName === NO_DISTRICT_EXPORT) {
      q = q.is('district_name', null);
    } else {
      q = q.eq('district_name', districtName);
    }

    if (schoolName) q = q.eq('school_name', schoolName);

    const { data, error } = await q.order('answer_date', { ascending: false }).limit(50000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) return new Response('id\n', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="export.csv"` },
    });

    const cols = Object.keys(rows[0]);
    function csvEscape(v: unknown): string {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))].join('\n');
    const safeName = (schoolName || districtName).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${safeName}_export.csv"`,
      },
    });
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────
  const districtName = searchParams.get('district') ?? '';
  const schoolName   = searchParams.get('school')   ?? '';
  const grade        = searchParams.get('grade')     ?? '';
  const gender       = searchParams.get('gender')    ?? '';
  const ethnicity    = searchParams.get('ethnicity') ?? '';
  const homeLang     = searchParams.get('homeLang')  ?? '';
  const hispanic     = searchParams.get('hispanic')  ?? ''; // 'true' | 'false' | ''
  const ell          = searchParams.get('ell')        ?? '';
  const frl          = searchParams.get('frl')        ?? '';
  const iep          = searchParams.get('iep')        ?? '';
  const sessionName  = searchParams.get('session')   ?? '';
  const courseId     = searchParams.get('course')    ?? '';
  const attribute    = searchParams.get('attribute') ?? '';
  const mediaType    = searchParams.get('mediaType') ?? '';
  const minScore     = parseInt(searchParams.get('minScore') ?? '0');
  const minWords     = parseInt(searchParams.get('minWords') ?? '0');
  const search       = searchParams.get('search')    ?? '';
  const page         = parseInt(searchParams.get('page') ?? '1');
  const limit        = 24;
  const offset       = (page - 1) * limit;

  if (!districtName) {
    return NextResponse.json({ rows: [], totalCount: 0, hasMore: false, filterOptions: {} });
  }

  const NO_DISTRICT = '(No District)';

  // Build a fresh query with all filters — called per page since Supabase builder is consumed on await
  function buildQ(from: number, pageSize: number) {
    let q = db
      .from('student_responses')
      .select('id, district_name, school_name, class_name, teacher_name, current_grade, gender, ethnicity, home_language, hispanic, ell, frl, iep, session_name, course_id, response_type, question_num, question, answer, harvard_attribute, harvard_score, harvard_impacter_score, casel_attribute, casel_score, casel_impacter_score, url, answer_date')
      .not('url', 'is', null);
    if (districtName === NO_DISTRICT) q = q.is('district_name', null);
    else q = q.eq('district_name', districtName);
    if (schoolName)   q = q.eq('school_name', schoolName);
    if (grade)        q = q.eq('current_grade', Number(grade));
    if (gender)       q = q.eq('gender', gender);
    if (ethnicity)    q = q.eq('ethnicity', ethnicity);
    if (homeLang)     q = q.eq('home_language', homeLang);
    if (hispanic)     q = q.eq('hispanic', hispanic === 'true');
    if (ell)          q = q.eq('ell', ell === 'true');
    if (frl)          q = q.eq('frl', frl === 'true');
    if (iep)          q = q.eq('iep', iep === 'true');
    if (sessionName)  q = q.eq('session_name', sessionName);
    if (courseId)     q = q.eq('course_id', courseId);
    if (attribute)    q = q.or(`harvard_attribute.eq.${attribute},casel_attribute.eq.${attribute}`);
    if (mediaType)    q = q.eq('response_type', mediaType);
    if (minScore > 0) q = q.or(`harvard_score.gte.${minScore},casel_score.gte.${minScore}`);
    if (search)       q = q.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);
    return q.order('answer_date', { ascending: false }).range(from, from + pageSize - 1);
  }

  // Fetch all matching rows across pages (Supabase hard-caps single queries at 1,000)
  const SR_PAGE = 1000;
  const rawRows: SRRow[] = [];
  let from = 0;
  while (rawRows.length < 20000) { // safety cap
    const { data, error } = await buildQ(from, SR_PAGE);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const page = (data ?? []) as SRRow[];
    rawRows.push(...page);
    if (page.length < SR_PAGE) break;
    from += SR_PAGE;
  }
  type SRRow = {
    id: number;
    district_name: string;
    school_name: string;
    class_name: string | null;
    teacher_name: string | null;
    current_grade: number | null;
    gender: string | null;
    ethnicity: string | null;
    home_language: string | null;
    hispanic: boolean | null;
    ell: boolean | null;
    frl: boolean | null;
    iep: boolean | null;
    session_name: string | null;
    course_id: string | null;
    response_type: string | null;
    question_num: string | null;
    question: string | null;
    answer: string | null;
    harvard_attribute: string | null;
    harvard_score: number | null;
    harvard_impacter_score: number | null;
    casel_attribute: string | null;
    casel_score: number | null;
    casel_impacter_score: number | null;
    url: string;
    answer_date: string | null;
  };

  let allRows = rawRows;

  // Word-count filter (done in JS since SQL can't easily count words)
  if (minWords > 0) {
    allRows = allRows.filter(r => wordCount(r.answer) >= minWords);
  }

  // ── Build filter options from full (pre-pagination) result set ────────────
  const gradesSet    = new Set<string>();
  const gendersSet   = new Set<string>();
  const ethnicitiesSet = new Set<string>();
  const homeLangsSet = new Set<string>();
  const sessionsSet  = new Set<string>();
  const coursesSet   = new Set<string>();
  const attribsSet   = new Set<string>();

  // Track booleans — only show as filter if both T and F exist
  let hispanicHasTrue = false, hispanicHasFalse = false;
  let ellHasTrue = false,      ellHasFalse = false;
  let frlHasTrue = false,      frlHasFalse = false;
  let iepHasTrue = false,      iepHasFalse = false;

  for (const r of allRows) {
    if (r.current_grade != null)  gradesSet.add(String(r.current_grade));
    if (r.gender)                 gendersSet.add(r.gender);
    if (r.ethnicity && r.ethnicity !== 'Unknown') ethnicitiesSet.add(r.ethnicity);
    if (r.home_language && r.home_language !== 'NA') homeLangsSet.add(r.home_language);
    if (r.session_name)           sessionsSet.add(r.session_name);
    if (r.course_id)              coursesSet.add(r.course_id);
    if (r.harvard_attribute)      attribsSet.add(r.harvard_attribute);
    if (r.casel_attribute)        attribsSet.add(r.casel_attribute);

    if (r.hispanic === true)  hispanicHasTrue  = true;
    if (r.hispanic === false) hispanicHasFalse = true;
    if (r.ell === true)       ellHasTrue       = true;
    if (r.ell === false)      ellHasFalse      = true;
    if (r.frl === true)       frlHasTrue       = true;
    if (r.frl === false)      frlHasFalse      = true;
    if (r.iep === true)       iepHasTrue       = true;
    if (r.iep === false)      iepHasFalse      = true;
  }

  const totalCount = allRows.length;
  const paginated  = allRows.slice(offset, offset + limit);
  const hasMore    = totalCount > offset + limit;

  // ── Cross-reference videoask.steps for share_url ──────────────────────────
  const shareUrlMap: Record<string, string> = {};
  const uuids = paginated.map(r => extractUuid(r.url)).filter((u): u is string => u !== null);

  if (uuids.length > 0) {
    try {
      const orConds = uuids.map(u => `media_url.ilike.%${u}%`).join(',');
      const { data: stepsData } = await db
        .schema('videoask')
        .from('steps')
        .select('media_url, share_url')
        .or(orConds)
        .limit(uuids.length * 2);

      if (stepsData) {
        for (const s of stepsData as { media_url: string | null; share_url: string | null }[]) {
          const uuid = extractUuid(s.media_url ?? '');
          if (uuid && s.share_url && !shareUrlMap[uuid]) shareUrlMap[uuid] = s.share_url;
        }
      }
    } catch { /* non-fatal */ }
  }

  const rowsWithShare = paginated.map(r => ({
    ...r,
    shareUrl: shareUrlMap[extractUuid(r.url) ?? ''] ?? null,
  }));

  return NextResponse.json({
    rows: rowsWithShare,
    totalCount,
    hasMore,
    page,
    filterOptions: {
      grades:      Array.from(gradesSet).sort((a, b) => Number(a) - Number(b)),
      genders:     Array.from(gendersSet).sort(),
      ethnicities: Array.from(ethnicitiesSet).sort(),
      homeLangs:   Array.from(homeLangsSet).sort(),
      sessions:    Array.from(sessionsSet).sort(),
      courses:     Array.from(coursesSet).sort(),
      attributes:  Array.from(attribsSet).sort(),
      // boolean fields: only true if BOTH values present in result
      hispanicVaries: hispanicHasTrue && hispanicHasFalse,
      ellVaries:      ellHasTrue && ellHasFalse,
      frlVaries:      frlHasTrue && frlHasFalse,
      iepVaries:      iepHasTrue && iepHasFalse,
    },
  });
}
