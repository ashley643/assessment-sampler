import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/discover
// Returns all distinct VideoAsk forms from videoask.steps grouped by form_id.
// Import status is NOT checked here (too slow) — it's shown when you open a form.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // Fetch total count first, then all pages in parallel
  const { count: totalCount, error: countErr } = await impacter
    .schema('videoask')
    .from('steps')
    .select('form_id', { count: 'exact', head: true })
    .not('form_id', 'is', null);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  const PAGE = 1000;
  const pageCount = Math.ceil((totalCount ?? 0) / PAGE);

  // Fetch all pages in parallel — only form_id + node_title (no raw JSONB blob)
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      impacter
        .schema('videoask')
        .from('steps')
        .select('form_id, node_title')
        .not('form_id', 'is', null)
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  );

  // Build form map
  type FormEntry = { total: number; sampleTitle: string | null };
  const formMap = new Map<string, FormEntry>();

  for (const { data, error } of pages) {
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const step of (data ?? []) as { form_id: string; node_title: string | null }[]) {
      const fid = step.form_id;
      if (!fid) continue;
      if (!formMap.has(fid)) formMap.set(fid, { total: 0, sampleTitle: step.node_title });
      formMap.get(fid)!.total++;
    }
  }

  // Try to get form names from videoask.forms table (may not exist)
  const formNames = new Map<string, string>();
  try {
    const { data: formsData } = await impacter
      .schema('videoask')
      .from('forms')
      .select('id, title, name');
    if (formsData) {
      for (const f of formsData as { id: string; title?: string; name?: string }[]) {
        const label = f.title || f.name || '';
        if (label) formNames.set(f.id, label);
      }
    }
  } catch { /* forms table may not exist */ }

  const forms = Array.from(formMap.entries()).map(([formId, { total, sampleTitle }]) => ({
    formId,
    formName: formNames.get(formId) ?? null,
    sampleTitle,
    totalSteps: total,
  })).sort((a, b) => (a.formName ?? a.formId).localeCompare(b.formName ?? b.formId));

  return NextResponse.json({ forms });
}
