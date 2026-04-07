import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// GET /api/admin/videoask-import/discover
// Returns all distinct VideoAsk form_titles from videoask.steps,
// annotated with how many of their steps are already in student_responses.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // 1. All (form_title, media_url) from videoask.steps
  const { data: stepsData, error: stepsErr } = await impacter
    .schema('videoask')
    .from('steps')
    .select('form_title, media_url, node_title')
    .not('form_title', 'is', null);

  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  // 2. All URLs already in student_responses
  const { data: srUrls, error: srErr } = await impacter
    .from('student_responses')
    .select('url')
    .not('url', 'is', null);

  if (srErr) return NextResponse.json({ error: srErr.message }, { status: 500 });

  const importedUuids = new Set<string>();
  for (const row of (srUrls ?? []) as { url: string }[]) {
    const uuid = extractUuid(row.url ?? '');
    if (uuid) importedUuids.add(uuid);
  }

  // 3. Group steps by form_title, count total and already-imported
  type FormEntry = { formTitle: string; totalSteps: number; importedSteps: number };
  const formMap = new Map<string, { total: number; imported: number }>();

  for (const step of (stepsData ?? []) as { form_title: string; media_url: string | null }[]) {
    const ft = step.form_title ?? '';
    if (!ft) continue;
    if (!formMap.has(ft)) formMap.set(ft, { total: 0, imported: 0 });
    const entry = formMap.get(ft)!;
    entry.total++;
    const uuid = extractUuid(step.media_url ?? '');
    if (uuid && importedUuids.has(uuid)) entry.imported++;
  }

  const forms: FormEntry[] = Array.from(formMap.entries())
    .map(([formTitle, { total, imported }]) => ({ formTitle, totalSteps: total, importedSteps: imported }))
    .sort((a, b) => a.formTitle.localeCompare(b.formTitle));

  return NextResponse.json({ forms });
}
