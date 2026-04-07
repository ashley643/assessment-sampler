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

  const [pilots, vPilotStats, responses, answers] = await Promise.all([
    probe('pilots'),
    probe('v_pilot_stats'),
    probe('responses'),
    probe('answers'),
  ]);

  // Distinct districts from v_pilot_stats if it has district_name
  const { data: districtRows } = await db.from('v_pilot_stats' as 'pilots').select('*').limit(50);
  const distinctDistricts = [...new Set((districtRows ?? []).map((r: Record<string, unknown>) => r.district_name as string).filter(Boolean))].sort();

  // Nested join test: answers → responses → pilots
  const { data: joinTest, error: joinErr } = await db
    .from('answers')
    .select('id, prompt_title, media_type, share_url, transcript, responses(school_name, grade_level, gender, pilot_id, pilots(name))')
    .limit(2);

  return NextResponse.json({
    pilots,
    v_pilot_stats: vPilotStats,
    responses,
    answers,
    distinct_districts_from_v_pilot_stats: distinctDistricts,
    join_test: { data: joinTest, error: joinErr },
  }, { status: 200 });
}
