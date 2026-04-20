import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

const CSV_HEADERS = [
  'district_name', 'session_name', 'school_name', 'class_name', 'teacher_name',
  'current_grade', 'hs_grad_year', 'last_name', 'first_name', 'student_email',
  'gender', 'hispanic', 'ell', 'frl', 'iep', 'ethnicity', 'home_language',
  'answer_date', 'answer_time', 'course_id', 'question_num', 'type',
  'question', 'answer', 'harvard_attribute', 'harvard_score', 'harvard_impacter_score',
  'casel_attribute', 'casel_score', 'casel_impacter_score', 'url', 'share_url',
  'word_count', 'response_duration', 'crosswalk_attribute', 'crosswalk_score',
  'crosswalk_impacter_score', 'score_band', 'grade_band', 'initials', 'id',
];

function csvCell(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function extractDate(dt: unknown): string {
  if (!dt) return '';
  return String(dt).slice(0, 10);
}

function extractTime(dt: unknown): string {
  if (!dt) return '';
  const m = String(dt).match(/[T ](\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function wordCount(text: unknown): string {
  if (!text) return '';
  const s = String(text).trim();
  if (!s) return '';
  return String(s.split(/\s+/).filter(Boolean).length);
}

// GET /api/admin/videoask-import/export
// Optional query params: course_id, session_name
export async function GET(req: Request) {
  if (!await getAdminSession()) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId    = searchParams.get('course_id');
  const sessionName = searchParams.get('session_name');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  const rows: Record<string, unknown>[] = [];
  const PAGE = 1000;
  let lastId = 0;

  while (true) {
    let q = impacter
      .from('student_responses')
      .select('*')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(PAGE);

    if (courseId)    q = q.eq('course_id', courseId);
    if (sessionName) q = q.eq('session_name', sessionName);

    const { data, error } = await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) break;
    lastId = page[page.length - 1].id as number;
  }

  const lines: string[] = [CSV_HEADERS.join(',')];

  for (const row of rows) {
    lines.push([
      csvCell(row.district_name),
      csvCell(row.session_name),
      csvCell(row.school_name),
      csvCell(row.class_name),
      csvCell(row.teacher_name),
      csvCell(row.current_grade),
      '',                                          // hs_grad_year — null
      csvCell(row.last_name),
      csvCell(row.first_name),
      csvCell(row.student_email),
      csvCell(row.gender),
      csvCell(row.hispanic),
      csvCell(row.ell),
      csvCell(row.frl),
      csvCell(row.iep),
      csvCell(row.ethnicity),
      csvCell(row.home_language),
      csvCell(extractDate(row.answer_date)),
      csvCell(extractTime(row.answer_date)),
      csvCell(row.course_id),
      csvCell(row.question_num),
      csvCell(row.response_type),                  // type
      csvCell(row.question),
      csvCell(row.answer),
      csvCell(row.harvard_attribute),
      csvCell(row.harvard_score),
      csvCell(row.harvard_impacter_score),
      csvCell(row.casel_attribute),
      csvCell(row.casel_score),
      csvCell(row.casel_impacter_score),
      csvCell(row.url),
      csvCell(row.share_url),
      csvCell(wordCount(row.answer)),
      csvCell(row.response_duration),
      csvCell(row.crosswalk_attribute),
      '',                                          // crosswalk_score — null
      '',                                          // crosswalk_impacter_score — null
      '',                                          // score_band — null
      '',                                          // grade_band — null
      '',                                          // initials — null
      csvCell(row.id),
    ].join(','));
  }

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="videoask-responses.csv"',
    },
  });
}
