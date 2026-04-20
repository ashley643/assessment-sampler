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
  const videoaskForms        = await probe('forms', 'videoask');
  const videoaskInteractions = await probe('interactions', 'videoask');

  // Show raw field keys + sample values for videoask.forms
  let formsRawSample: Record<string, unknown> | null = null;
  {
    const { data } = await (db as any).schema('videoask').from('forms').select('raw').not('raw', 'is', null).limit(1);
    if (data?.[0]?.raw) {
      const raw = data[0].raw as Record<string, unknown>;
      // Show keys + shallow preview of each value
      formsRawSample = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [
          k,
          Array.isArray(v) ? `[array len=${(v as unknown[]).length}, sample=${JSON.stringify((v as unknown[])[0]).slice(0, 200)}]`
            : typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 200)
            : v,
        ])
      );
    }
  }

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
    videoask_forms: videoaskForms,
    videoask_forms_raw_sample: formsRawSample,
    videoask_interactions: videoaskInteractions,
    target_form_count: targetFormCount,
    target_form_error: targetErr?.message ?? null,
    distinct_form_ids: formIdCounts,
  }, { status: 200 });
}
