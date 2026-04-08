import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/debug
// Investigates what's actually in the videoask schema tables
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;
  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId'); // optional: focus on a specific form
  const results: Record<string, unknown> = {};

  // 1. Look for tables that might hold node/question definitions with overlay text
  for (const tbl of ['nodes', 'questions', 'question_nodes', 'node_definitions', 'form_nodes', 'form_questions']) {
    try {
      const { data, error } = await impacter.schema('videoask').from(tbl).select('*').limit(2);
      results[`table_${tbl}`] = { data, error: error?.message ?? null };
    } catch (e) {
      results[`table_${tbl}`] = { error: String(e) };
    }
  }

  // 2. Check the steps raw JSONB for overlay text clues on a specific form
  if (formId) {
    try {
      const { data, error } = await impacter
        .schema('videoask')
        .from('steps')
        .select('id, node_id, node_title, node_text, raw')
        .eq('form_id', formId)
        .limit(3);
      results.steps_for_form = { data, error: error?.message ?? null };
    } catch (e) {
      results.steps_for_form = { error: String(e) };
    }

    // 3. Check if this form's raw JSON in forms table has node definitions
    try {
      const { data, error } = await impacter
        .schema('videoask')
        .from('forms')
        .select('id, title, raw')
        .eq('id', formId)
        .limit(1);
      // Return raw keys only to avoid massive output
      if (data && data[0]?.raw) {
        const rawKeys = Object.keys(data[0].raw as object);
        results.form_raw_keys = rawKeys;
        // Check if there's a nodes/questions array in the raw
        const raw = data[0].raw as Record<string, unknown>;
        for (const key of ['nodes', 'questions', 'items', 'steps', 'flow']) {
          if (raw[key]) results[`form_raw_${key}_sample`] = Array.isArray(raw[key])
            ? (raw[key] as unknown[]).slice(0, 2)
            : raw[key];
        }
      }
      results.form_title = (data?.[0] as { title?: string })?.title ?? null;
      results.form_query_error = error?.message ?? null;
    } catch (e) {
      results.form_raw = { error: String(e) };
    }
  }

  // 4. Check forms.raw top-level keys for first form to understand structure
  try {
    const { data } = await impacter
      .schema('videoask')
      .from('forms')
      .select('id, title, raw')
      .limit(1);
    if (data?.[0]?.raw) {
      results.first_form_raw_keys = Object.keys(data[0].raw as object);
    }
  } catch { /* ignore */ }

  return NextResponse.json(results, { status: 200 });
}
