import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// Targeted discovery — shows columns + sample rows for the tables we care about
// for building the district/school Response Finder.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getImpacterClient();

  async function probe(table: string, schema = 'public') {
    const { data, error } = await db.schema(schema as 'public').from(table).select('*').limit(2);
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { columns: [], rows: [] };
    return {
      columns: Object.keys(data[0] as object),
      rows: data,
    };
  }

  const [studentResponses, answers, responses, vAll] = await Promise.all([
    probe('student_responses'),
    probe('answers'),
    probe('responses'),
    probe('v_all_student_responses'),
  ]);

  // Also get distinct districts from student_responses
  const { data: districts } = await db
    .from('student_responses')
    .select('district_name')
    .not('district_name', 'is', null)
    .limit(200);

  const distinctDistricts = [...new Set((districts ?? []).map((r: Record<string, unknown>) => r.district_name as string))].sort();

  return NextResponse.json({
    student_responses: studentResponses,
    answers: answers,
    responses: responses,
    v_all_student_responses: vAll,
    distinct_districts_sample: distinctDistricts,
  }, { status: 200 });
}
