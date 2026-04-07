import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/** Extract the VideoAsk media UUID from a signed URL like
 *  https://media.videoask.com/transcoded/{uuid}/video.mp4?token=...
 *  Also handles audio: .../audio.mp3?token=...
 */
function extractUuid(url: string): string | null {
  const m = url.match(/transcoded\/([0-9a-f-]{36})\//i);
  return m ? m[1] : null;
}

export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'search';

  const db = getImpacterClient() as unknown as DB;

  // ── SIDEBAR mode ──────────────────────────────────────────────────────────
  // Paginates through student_responses ordered by district/school to build
  // the full district → school tree regardless of PostgREST row limits.
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

  // ── SEARCH mode ───────────────────────────────────────────────────────────
  const districtName = searchParams.get('district') ?? '';
  const schoolName   = searchParams.get('school') ?? '';
  const grade        = searchParams.get('grade') ?? '';
  const gender       = searchParams.get('gender') ?? '';
  const sessionName  = searchParams.get('session') ?? '';
  const courseId     = searchParams.get('course') ?? '';
  const attribute    = searchParams.get('attribute') ?? '';
  const mediaType    = searchParams.get('mediaType') ?? ''; // 'video' | 'audio' | ''
  const search       = searchParams.get('search') ?? '';
  const page         = parseInt(searchParams.get('page') ?? '1');
  const limit        = 24;
  const offset       = (page - 1) * limit;

  if (!districtName) {
    return NextResponse.json({
      rows: [], totalCount: 0, hasMore: false,
      filterOptions: { grades: [], genders: [], sessions: [], courses: [], attributes: [] },
    });
  }

  let q = db
    .from('student_responses')
    .select('id, district_name, school_name, class_name, teacher_name, current_grade, gender, session_name, course_id, response_type, question_num, question, answer, harvard_attribute, harvard_score, harvard_impacter_score, casel_attribute, casel_score, casel_impacter_score, url, answer_date')
    .not('url', 'is', null)
    .eq('district_name', districtName);

  if (schoolName)  q = q.eq('school_name', schoolName);
  if (grade)       q = q.eq('current_grade', Number(grade));
  if (gender)      q = q.eq('gender', gender);
  if (sessionName) q = q.eq('session_name', sessionName);
  if (courseId)    q = q.eq('course_id', courseId);
  if (attribute)   q = q.or(`harvard_attribute.eq.${attribute},casel_attribute.eq.${attribute}`);
  if (mediaType)   q = q.eq('response_type', mediaType);
  if (search)      q = q.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);

  const { data, error } = await q
    .order('answer_date', { ascending: false })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type SRRow = {
    id: number;
    district_name: string;
    school_name: string;
    class_name: string | null;
    teacher_name: string | null;
    current_grade: number | null;
    gender: string | null;
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

  const allRows = (data ?? []) as SRRow[];

  // Collect filter options from full result
  const gradesSet   = new Set<string>();
  const gendersSet  = new Set<string>();
  const sessionsSet = new Set<string>();
  const coursesSet  = new Set<string>();
  const attribsSet  = new Set<string>();

  for (const r of allRows) {
    if (r.current_grade != null) gradesSet.add(String(r.current_grade));
    if (r.gender)        gendersSet.add(r.gender);
    if (r.session_name)  sessionsSet.add(r.session_name);
    if (r.course_id)     coursesSet.add(r.course_id);
    if (r.harvard_attribute) attribsSet.add(r.harvard_attribute);
    if (r.casel_attribute)   attribsSet.add(r.casel_attribute);
  }

  const totalCount = allRows.length;
  const paginated  = allRows.slice(offset, offset + limit);
  const hasMore    = totalCount > offset + limit;

  // ── Cross-reference videoask.steps for share_url ─────────────────────────
  // student_responses.url = signed direct download URL (mp4/mp3)
  // videoask.steps.media_url = same base path (may differ by token)
  // We match on the UUID in the path: .../transcoded/{uuid}/video.mp4
  const shareUrlMap: Record<string, string> = {};

  const uuids = paginated
    .map(r => extractUuid(r.url))
    .filter((u): u is string => u !== null);

  if (uuids.length > 0) {
    try {
      // Build OR condition: media_url.ilike.%{uuid}% for each UUID
      const orConds = uuids.map(u => `media_url.ilike.%${u}%`).join(',');
      const { data: stepsData } = await db
        .schema('videoask')
        .from('steps')
        .select('media_url, share_url')
        .or(orConds)
        .limit(uuids.length * 2); // a step can have multiple entries, grab a few per UUID

      if (stepsData) {
        for (const s of stepsData as { media_url: string | null; share_url: string | null }[]) {
          const uuid = extractUuid(s.media_url ?? '');
          if (uuid && s.share_url && !shareUrlMap[uuid]) {
            shareUrlMap[uuid] = s.share_url;
          }
        }
      }
    } catch {
      // Non-fatal — we'll just show the download URL without a share link
    }
  }

  // Attach share_url to each paginated row
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
      grades:     Array.from(gradesSet).sort((a, b) => Number(a) - Number(b)),
      genders:    Array.from(gendersSet).sort(),
      sessions:   Array.from(sessionsSet).sort(),
      courses:    Array.from(coursesSet).sort(),
      attributes: Array.from(attribsSet).sort(),
    },
  });
}
