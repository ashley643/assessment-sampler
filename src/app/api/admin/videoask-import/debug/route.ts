import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/debug?formId=...
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;
  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  const results: Record<string, unknown> = {};

  // 1. How many forms total in videoask.forms?
  try {
    const { count, error } = await impacter
      .schema('videoask').from('forms').select('id', { count: 'exact', head: true });
    results.forms_count = { count, error: error?.message ?? null };
  } catch (e) { results.forms_count = { error: String(e) }; }

  // 2. If formId given, check if it's in the forms table
  if (formId) {
    try {
      const { data, error } = await impacter
        .schema('videoask').from('forms')
        .select('id, title, raw')
        .eq('id', formId)
        .limit(1);
      if (data?.[0]) {
        const raw = data[0].raw as Record<string, unknown> ?? {};
        results.form_found = { title: data[0].title, raw_keys: Object.keys(raw) };
        // Check for questions/nodes in the raw
        for (const key of ['nodes', 'questions', 'items', 'steps', 'questions_flow', 'flow']) {
          if (raw[key] !== undefined) {
            const val = raw[key];
            results[`form_raw_${key}`] = Array.isArray(val) ? (val as unknown[]).slice(0, 2) : val;
          }
        }
        // Show first_question metadata text
        const fq = raw.first_question as Record<string, unknown> | undefined;
        results.first_question_text = (fq?.metadata as Record<string, unknown> | undefined)?.text ?? fq?.title ?? null;
      } else {
        results.form_found = { title: null, error: error?.message ?? 'not found in forms table' };
      }
    } catch (e) { results.form_found = { error: String(e) }; }

    // 3. Check what columns steps actually has (look at a full row)
    try {
      const { data, error } = await impacter
        .schema('videoask').from('steps')
        .select('*')
        .eq('form_id', formId)
        .limit(1);
      if (data?.[0]) {
        const row = data[0] as Record<string, unknown>;
        results.step_columns = Object.keys(row);
        // Show non-null columns and their values (omit raw to keep output small)
        const preview: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (k !== 'raw' && v !== null && v !== undefined) preview[k] = v;
        }
        results.step_non_null_fields = preview;
        // Show raw keys
        if (row.raw) {
          const rawObj = row.raw as Record<string, unknown>;
          results.step_raw_keys = Object.keys(rawObj);
          // form_metadata might contain all question definitions with overlay text
          if (rawObj.form_metadata) results.step_raw_form_metadata = rawObj.form_metadata;
        }
      }
      results.step_query_error = error?.message ?? null;
    } catch (e) { results.step_columns_err = String(e); }
  }

  // 4. Check for any tables that might hold question/node definitions
  for (const tbl of ['nodes', 'questions', 'question_nodes', 'node_definitions', 'form_nodes', 'form_questions', 'question_flow']) {
    try {
      const { data, error } = await impacter.schema('videoask').from(tbl).select('*').limit(1);
      results[`table_${tbl}`] = data?.length ? { exists: true, sample: data[0] } : { exists: false, error: error?.message };
    } catch (e) { results[`table_${tbl}`] = { error: String(e) }; }
  }

  // 5. Sample 5 distinct form_ids from steps to cross-check with forms table
  try {
    const { data } = await impacter
      .schema('videoask').from('steps')
      .select('form_id')
      .order('form_id')
      .limit(50);
    if (data) {
      const ids = [...new Set((data as { form_id: string }[]).map(r => r.form_id))].slice(0, 5);
      results.sample_step_form_ids = ids;
      // Check which of these exist in forms table
      const { data: found } = await impacter
        .schema('videoask').from('forms')
        .select('id, title')
        .in('id', ids);
      results.step_form_ids_in_forms_table = found ?? [];
    }
  } catch (e) { results.form_id_crosscheck = { error: String(e) }; }

  return NextResponse.json(results, { status: 200 });
}
