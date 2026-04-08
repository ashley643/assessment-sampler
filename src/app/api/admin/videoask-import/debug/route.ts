import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/debug
// Investigates what's actually in the videoask schema tables
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;
  const results: Record<string, unknown> = {};

  // 1. Try videoask.forms
  try {
    const { data, error } = await impacter.schema('videoask').from('forms').select('*').limit(3);
    results.forms = { data, error: error?.message ?? null };
  } catch (e) {
    results.forms = { data: null, error: String(e) };
  }

  // 2. Try common alternative table names
  for (const tbl of ['form', 'videoask_forms', 'videoasks', 'surveys']) {
    try {
      const { data, error } = await impacter.schema('videoask').from(tbl).select('*').limit(2);
      results[`alt_${tbl}`] = { data, error: error?.message ?? null };
    } catch (e) {
      results[`alt_${tbl}`] = { error: String(e) };
    }
  }

  // 3. Sample steps — show node_text and form_id so we know what's populated
  try {
    const { data, error } = await impacter
      .schema('videoask')
      .from('steps')
      .select('id, form_id, node_id, node_title, node_text')
      .limit(5);
    results.steps_sample = { data, error: error?.message ?? null };
  } catch (e) {
    results.steps_sample = { error: String(e) };
  }

  // 4. Check if node_text is non-null for any rows
  try {
    const { data, error } = await impacter
      .schema('videoask')
      .from('steps')
      .select('id, form_id, node_title, node_text')
      .not('node_text', 'is', null)
      .limit(3);
    results.steps_with_node_text = { data, error: error?.message ?? null };
  } catch (e) {
    results.steps_with_node_text = { error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
