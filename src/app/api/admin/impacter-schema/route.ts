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

  const studentResponses = await probe('student_responses');

  // Count total rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: totalCount } = await (db as any)
    .from('student_responses')
    .select('*', { count: 'exact', head: true });

  // Count rows where url IS NOT NULL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: mediaCount } = await (db as any)
    .from('student_responses')
    .select('*', { count: 'exact', head: true })
    .not('url', 'is', null);

  // Sample rows where url IS NOT NULL (the VideoAsk media rows)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mediaRows, error: mediaErr } = await (db as any)
    .from('student_responses')
    .select('*')
    .not('url', 'is', null)
    .limit(3);

  const videoaskSteps = await probe('steps', 'videoask');

  // Check for a specific form_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: targetFormCount, error: targetErr } = await (db as any)
    .schema('videoask')
    .from('steps')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', 'c90ddfd9-e3c1-4c6e-bb7e-4f7abfcc9a25');

  // Also get distinct form_ids to see what's available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: distinctForms } = await (db as any)
    .schema('videoask')
    .from('steps')
    .select('form_id')
    .limit(500);

  const formIdCounts: Record<string, number> = {};
  for (const row of (distinctForms ?? [])) {
    const fid = row.form_id ?? 'null';
    formIdCounts[fid] = (formIdCounts[fid] ?? 0) + 1;
  }

  return NextResponse.json({
    student_responses: studentResponses,
    total_row_count: totalCount,
    rows_with_url_count: mediaCount,
    media_rows: mediaRows,
    media_rows_error: mediaErr?.message ?? null,
    videoask_steps: videoaskSteps,
    target_form_count: targetFormCount,
    target_form_error: targetErr?.message ?? null,
    distinct_form_ids: formIdCounts,
  }, { status: 200 });
}
