import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// GET /api/admin/videoask-import/discover
// Returns only VideoAsk forms that have NO responses in student_responses yet.
// Fetches both tables fully in parallel to avoid timeouts.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;
  const PAGE = 1000;

  // 1. Get total counts for both tables in parallel
  const [stepsCountRes, srCountRes] = await Promise.all([
    impacter.schema('videoask').from('steps')
      .select('form_id', { count: 'exact', head: true })
      .not('form_id', 'is', null),
    impacter.from('student_responses')
      .select('url', { count: 'exact', head: true })
      .not('url', 'is', null),
  ]);

  if (stepsCountRes.error) return NextResponse.json({ error: stepsCountRes.error.message }, { status: 500 });
  if (srCountRes.error) return NextResponse.json({ error: srCountRes.error.message }, { status: 500 });

  const stepsTotal = stepsCountRes.count ?? 0;
  const srTotal = srCountRes.count ?? 0;
  const stepsPages = Math.ceil(stepsTotal / PAGE);
  const srPages = Math.ceil(srTotal / PAGE);

  // 2. Fetch all pages of both tables in parallel simultaneously
  const [stepsResults, srResults] = await Promise.all([
    Promise.all(
      Array.from({ length: stepsPages }, (_, i) =>
        impacter.schema('videoask').from('steps')
          .select('form_id, media_url, node_title')
          .not('form_id', 'is', null)
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
    ),
    Promise.all(
      Array.from({ length: srPages }, (_, i) =>
        impacter.from('student_responses')
          .select('url')
          .not('url', 'is', null)
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
    ),
  ]);

  // 3. Build set of already-imported UUIDs from student_responses
  const importedUuids = new Set<string>();
  for (const { data, error } of srResults) {
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of (data ?? []) as { url: string }[]) {
      const uuid = extractUuid(row.url ?? '');
      if (uuid) importedUuids.add(uuid);
    }
  }

  // 4. Build form map from videoask steps
  type FormEntry = { total: number; imported: number; sampleTitle: string | null };
  const formMap = new Map<string, FormEntry>();

  for (const { data, error } of stepsResults) {
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const step of (data ?? []) as { form_id: string; media_url: string | null; node_title: string | null }[]) {
      const fid = step.form_id;
      if (!fid) continue;
      if (!formMap.has(fid)) formMap.set(fid, { total: 0, imported: 0, sampleTitle: step.node_title });
      const entry = formMap.get(fid)!;
      entry.total++;
      const uuid = extractUuid(step.media_url ?? '');
      if (uuid && importedUuids.has(uuid)) entry.imported++;
    }
  }

  // 5. Try to get form names from videoask.forms (may not exist)
  const formNames = new Map<string, string>();
  try {
    const { data: formsData } = await impacter.schema('videoask').from('forms').select('id, title, name');
    if (formsData) {
      for (const f of formsData as { id: string; title?: string; name?: string }[]) {
        const label = f.title || f.name || '';
        if (label) formNames.set(f.id, label);
      }
    }
  } catch { /* forms table may not exist */ }

  // 6. Return all forms; mark ones that have already been imported
  const forms = Array.from(formMap.entries())
    .map(([formId, { total, imported, sampleTitle }]) => ({
      formId,
      formName: formNames.get(formId) ?? null,
      sampleTitle,
      totalSteps: total,
      imported,
      isImported: imported > 0,
    }))
    .sort((a, b) => {
      // Unimported first, then by response count descending
      if (a.isImported !== b.isImported) return a.isImported ? 1 : -1;
      return b.totalSteps - a.totalSteps;
    });

  return NextResponse.json({ forms });
}
