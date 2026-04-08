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
  if (formId) {
    try {
      // Get distinct node_ids for this form and check if any exist as forms.id
      const { data: nodeRows } = await impacter
        .schema('videoask').from('steps')
        .select('node_id, node_title')
        .eq('form_id', formId)
        .limit(100);
      if (nodeRows) {
        const nodeIds = [...new Set((nodeRows as { node_id: string; node_title: string }[]).map(r => r.node_id))];
        results.distinct_node_ids = nodeIds;
        // Check if any node_id exists as a forms.id (i.e. each question is also a form entry)
        const { data: nodesAsForms } = await impacter
          .schema('videoask').from('forms')
          .select('id, title, raw')
          .in('id', nodeIds);
        if (nodesAsForms && (nodesAsForms as unknown[]).length > 0) {
          results.nodes_found_as_forms = (nodesAsForms as { id: string; title: string; raw: Record<string, unknown> }[]).map(f => ({
            id: f.id,
            title: f.title,
            first_question_text: (f.raw?.first_question as Record<string, unknown> | undefined)?.metadata
              ? ((f.raw.first_question as Record<string, unknown>).metadata as Record<string, unknown>).text
              : null,
          }));
        } else {
          results.nodes_found_as_forms = 'none — node_ids do not appear in forms table';
        }
      }
    } catch (e) { results.node_as_form_check = { error: String(e) }; }
  }

  return NextResponse.json(results, { status: 200 });
}
