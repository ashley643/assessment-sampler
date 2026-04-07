import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;
type FlexClient = { from: (t: string) => AnyQuery };

export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'search';

  const db = getImpacterClient() as unknown as FlexClient;

  // ── SIDEBAR mode ──────────────────────────────────────────────────────────
  if (mode === 'sidebar') {
    // Fetch all distinct (district_name, school_name) pairs
    const { data, error } = await db.from('student_responses')
      .select('district_name, school_name')
      .limit(20000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type Row = { district_name: string | null; school_name: string | null };
    const rows = (data ?? []) as Row[];

    // Build district → schools tree, deduplicating in JS
    const districtMap: Record<string, Set<string>> = {};
    for (const r of rows) {
      const d = r.district_name ?? 'Unknown District';
      if (!districtMap[d]) districtMap[d] = new Set();
      if (r.school_name) districtMap[d].add(r.school_name);
    }

    const districts = Object.entries(districtMap)
      .map(([name, schools]) => ({ name, schools: Array.from(schools).sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ districts });
  }

  // ── SEARCH mode ───────────────────────────────────────────────────────────
  const districtName  = searchParams.get('district') ?? '';
  const schoolName    = searchParams.get('school') ?? '';
  const grade         = searchParams.get('grade') ?? '';
  const gender        = searchParams.get('gender') ?? '';
  const sessionName   = searchParams.get('session') ?? '';
  const courseId      = searchParams.get('course') ?? '';
  const responseType  = searchParams.get('responseType') ?? '';
  const attribute     = searchParams.get('attribute') ?? '';
  const search        = searchParams.get('search') ?? '';
  const page          = parseInt(searchParams.get('page') ?? '1');
  const limit         = 30;
  const offset        = (page - 1) * limit;

  if (!districtName) {
    return NextResponse.json({
      rows: [], totalCount: 0, hasMore: false,
      filterOptions: { grades: [], genders: [], sessions: [], courses: [], responseTypes: [], attributes: [] },
    });
  }

  let q = db.from('student_responses')
    .select('id, district_name, school_name, class_name, teacher_name, current_grade, gender, session_name, course_id, response_type, question_num, question, answer, harvard_attribute, harvard_score, harvard_impacter_score, casel_attribute, casel_score, casel_impacter_score, url, answer_date')
    .eq('district_name', districtName);

  if (schoolName)   q = q.eq('school_name', schoolName);
  if (grade)        q = q.eq('current_grade', Number(grade));
  if (gender)       q = q.eq('gender', gender);
  if (sessionName)  q = q.eq('session_name', sessionName);
  if (courseId)     q = q.eq('course_id', courseId);
  if (responseType) q = q.eq('response_type', responseType);
  if (attribute)    q = q.or(`harvard_attribute.eq.${attribute},casel_attribute.eq.${attribute}`);
  if (search)       q = q.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);

  const { data, error } = await q.order('answer_date', { ascending: false }).limit(5000);

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
    url: string | null;
    answer_date: string | null;
  };

  const allRows = (data ?? []) as SRRow[];

  // Collect filter options from full result set (before pagination)
  const gradesSet        = new Set<string>();
  const gendersSet       = new Set<string>();
  const sessionsSet      = new Set<string>();
  const coursesSet       = new Set<string>();
  const responseTypesSet = new Set<string>();
  const attributesSet    = new Set<string>();

  for (const r of allRows) {
    if (r.current_grade != null) gradesSet.add(String(r.current_grade));
    if (r.gender)         gendersSet.add(r.gender);
    if (r.session_name)   sessionsSet.add(r.session_name);
    if (r.course_id)      coursesSet.add(r.course_id);
    if (r.response_type)  responseTypesSet.add(r.response_type);
    if (r.harvard_attribute) attributesSet.add(r.harvard_attribute);
    if (r.casel_attribute)   attributesSet.add(r.casel_attribute);
  }

  const totalCount = allRows.length;
  const paginated  = allRows.slice(offset, offset + limit);
  const hasMore    = totalCount > offset + limit;

  return NextResponse.json({
    rows: paginated,
    totalCount,
    hasMore,
    page,
    filterOptions: {
      grades:        Array.from(gradesSet).sort((a, b) => Number(a) - Number(b)),
      genders:       Array.from(gendersSet).sort(),
      sessions:      Array.from(sessionsSet).sort(),
      courses:       Array.from(coursesSet).sort(),
      responseTypes: Array.from(responseTypesSet).sort(),
      attributes:    Array.from(attributesSet).sort(),
    },
  });
}
