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

  // 1. Paginate ALL rows from videoask.steps (Supabase default page size is 1000)
  type StepRow = { form_id: string; media_url: string | null; node_title: string | null; raw: Record<string, unknown> | null };
  const allSteps: StepRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await impacter
      .schema('videoask')
      .from('steps')
      .select('form_id, media_url, node_title, raw')
      .not('form_id', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []) as StepRow[];
    allSteps.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

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

  // 3. Paginate all URLs already in student_responses
  const importedUuids = new Set<string>();
  let srOffset = 0;
  while (true) {
    const { data: srUrls, error: srErr } = await impacter
      .from('student_responses')
      .select('url')
      .not('url', 'is', null)
      .range(srOffset, srOffset + PAGE - 1);

    if (srErr) return NextResponse.json({ error: srErr.message }, { status: 500 });
    const rows = (srUrls ?? []) as { url: string }[];
    for (const row of rows) {
      const uuid = extractUuid(row.url ?? '');
      if (uuid) importedUuids.add(uuid);
    }
    if (rows.length < PAGE) break;
    srOffset += PAGE;
  }

  // 4. Group steps by form_id, collect display info + counts
  const formMap = new Map<string, { total: number; imported: number; sampleTitle: string | null; shareId: string | null }>();

  for (const step of allSteps) {
    const fid = step.form_id ?? '';
    if (!fid) continue;
    if (!formMap.has(fid)) {
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
  })).sort((a, b) => (a.formName ?? a.shareId ?? a.formId).localeCompare(b.formName ?? b.shareId ?? b.formId));

  return NextResponse.json({ forms });
}
