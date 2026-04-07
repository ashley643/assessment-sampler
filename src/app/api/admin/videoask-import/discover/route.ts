import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// GET /api/admin/videoask-import/discover
// Returns all VideoAsk forms with import status.
// Uses cursor-based pagination on both tables to avoid statement timeouts.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;
  const PAGE = 1000;

  // 1. Cursor-scan videoask.steps for form_id / media_url / node_title
  type StepRow = { id: string; form_id: string; media_url: string | null; node_title: string | null };
  const allSteps: StepRow[] = [];
  let lastStepId = '00000000-0000-0000-0000-000000000000';

  while (true) {
    const { data, error } = await impacter
      .schema('videoask')
      .from('steps')
      .select('id, form_id, media_url, node_title')
      .not('form_id', 'is', null)
      .gt('id', lastStepId)
      .order('id', { ascending: true })
      .limit(PAGE);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as StepRow[];
    allSteps.push(...rows);
    if (rows.length < PAGE) break;
    lastStepId = rows[rows.length - 1].id;
  }

  // 2. Cursor-scan student_responses for imported URL UUIDs
  const importedUuids = new Set<string>();
  let lastSrId = 0;

  while (true) {
    const { data, error } = await impacter
      .from('student_responses')
      .select('id, url')
      .not('url', 'is', null)
      .gt('id', lastSrId)
      .order('id', { ascending: true })
      .limit(PAGE);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as { id: number; url: string }[];
    for (const row of rows) {
      const uuid = extractUuid(row.url ?? '');
      if (uuid) importedUuids.add(uuid);
    }
    if (rows.length < PAGE) break;
    lastSrId = rows[rows.length - 1].id;
  }

  // 3. Build form map
  type FormEntry = { total: number; imported: number; sampleTitle: string | null };
  const formMap = new Map<string, FormEntry>();

  for (const step of allSteps) {
    const fid = step.form_id;
    if (!fid) continue;
    if (!formMap.has(fid)) formMap.set(fid, { total: 0, imported: 0, sampleTitle: step.node_title });
    const entry = formMap.get(fid)!;
    entry.total++;
    const uuid = extractUuid(step.media_url ?? '');
    if (uuid && importedUuids.has(uuid)) entry.imported++;
  }

  // 4. Try to get form names from videoask.forms (may not exist)
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

  // 5. Return all forms; unimported first, then by response count desc
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
      if (a.isImported !== b.isImported) return a.isImported ? 1 : -1;
      return b.totalSteps - a.totalSteps;
    });

  return NextResponse.json({ forms });
}
