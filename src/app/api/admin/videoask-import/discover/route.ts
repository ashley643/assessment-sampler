import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// GET /api/admin/videoask-import/discover
// Returns all distinct VideoAsk forms from videoask.steps (grouped by form_id),
// annotated with how many of their steps are already in student_responses.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // 1. All (form_id, media_url, node_title, raw) from videoask.steps
  const { data: stepsData, error: stepsErr } = await impacter
    .schema('videoask')
    .from('steps')
    .select('form_id, media_url, node_title, raw')
    .not('form_id', 'is', null);

  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  // 2. Try to get form names from videoask.forms table (may not exist)
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
  } catch {
    // forms table may not exist — that's fine
  }

  // 3. All URLs already in student_responses
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

  // 4. Group steps by form_id, collect display info + counts
  type StepRow = { form_id: string; media_url: string | null; node_title: string | null; raw: Record<string, unknown> | null };
  const formMap = new Map<string, { total: number; imported: number; sampleTitle: string | null; shareId: string | null }>();

  for (const step of (stepsData ?? []) as StepRow[]) {
    const fid = step.form_id ?? '';
    if (!fid) continue;
    if (!formMap.has(fid)) {
      // Try to extract a share ID and form title from raw JSONB
      const raw = step.raw ?? {};
      const shareId = (raw.form_share_id as string) ?? null;
      formMap.set(fid, { total: 0, imported: 0, sampleTitle: step.node_title, shareId });
    }
    const entry = formMap.get(fid)!;
    entry.total++;
    const uuid = extractUuid(step.media_url ?? '');
    if (uuid && importedUuids.has(uuid)) entry.imported++;
  }

  const forms = Array.from(formMap.entries()).map(([formId, { total, imported, sampleTitle, shareId }]) => ({
    formId,
    formName: formNames.get(formId) ?? null,
    shareId,
    sampleTitle,
    totalSteps: total,
    importedSteps: imported,
  })).sort((a, b) => (a.formName ?? a.formId).localeCompare(b.formName ?? b.formId));

  return NextResponse.json({ forms });
}
