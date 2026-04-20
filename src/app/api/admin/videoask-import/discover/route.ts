import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const CACHE_KEY = '__discover_cache__';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

type FormEntry = { total: number; sampleTitle: string | null; formName: string | null };

type CacheState = {
  lastStepId?: string;
  lastSrId?: number;
  forms?: Record<string, FormEntry>;
  uuidToFormId?: Record<string, string>;
  labels?: Record<string, string>;  // user-defined display labels
  hidden?: string[];                 // deleted/hidden form IDs
};

// GET /api/admin/videoask-import/discover
// First call: full scan. Subsequent calls: only fetch steps/responses added since last scan.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;
  const ourDb = getSupabaseAdmin();
  const PAGE = 1000;

  // ── 1. Load cached state ──────────────────────────────────────────────────
  const { data: cacheRow } = await ourDb
    .from('videoask_import_configs')
    .select('column_mappings')
    .eq('form_title', CACHE_KEY)
    .maybeSingle();

  const cache = (cacheRow?.column_mappings ?? {}) as CacheState;
  const formMap    = new Map<string, FormEntry>(Object.entries(cache.forms ?? {}));
  const uuidToForm = new Map<string, string>(Object.entries(cache.uuidToFormId ?? {}));
  const labelsMap  = new Map<string, string>(Object.entries(cache.labels ?? {}));
  const hiddenSet  = new Set<string>(cache.hidden ?? []);
  let lastStepId: string = cache.lastStepId ?? '00000000-0000-0000-0000-000000000000';
  let lastSrId:   number = cache.lastSrId   ?? 0;
  const isFirstRun = !cacheRow;

  // ── 2. Scan NEW videoask.steps (cursor-based) ─────────────────────────────
  let maxStepId = lastStepId;
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
    const rows = (data ?? []) as { id: string; form_id: string; media_url: string | null; node_title: string | null }[];

    for (const step of rows) {
      const fid = step.form_id;
      if (!fid) continue;
      if (!formMap.has(fid)) formMap.set(fid, { total: 0, sampleTitle: step.node_title, formName: null });
      formMap.get(fid)!.total++;
      const uuid = extractUuid(step.media_url ?? '');
      if (uuid) uuidToForm.set(uuid, fid);
      if (step.id > maxStepId) maxStepId = step.id;
    }

    if (rows.length < PAGE) break;
    lastStepId = rows[rows.length - 1].id;
  }

  // ── 3. Scan NEW student_responses (cursor-based) for import status ────────
  const importedByForm = new Map<string, number>();
  // Pre-fill from existing knowledge (forms already marked imported stay imported)
  // We'll recount from new SR rows only — tracks incremental imports correctly
  let maxSrId = lastSrId;
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
      if (row.id > maxSrId) maxSrId = row.id;
      const uuid = extractUuid(row.url ?? '');
      if (!uuid) continue;
      const fid = uuidToForm.get(uuid);
      if (fid) importedByForm.set(fid, (importedByForm.get(fid) ?? 0) + 1);
    }

    if (rows.length < PAGE) break;
    lastSrId = rows[rows.length - 1].id;
  }

  // ── 4. Fetch form names — always, so any form with a missing name gets filled ─
  try {
    const { data: formsData, error: formsErr } = await impacter.schema('videoask').from('forms').select('id, title');
    if (!formsErr && formsData) {
      for (const f of formsData as { id: string; title?: string }[]) {
        const label = f.title ?? '';
        if (label && formMap.has(f.id)) formMap.get(f.id)!.formName = label;
      }
    }
  } catch { /* forms table may not exist */ }

  // ── 5. Merge new import counts into cached imported totals ─────────────────
  // We store per-form imported counts in cache so they accumulate across scans
  const cachedImported = (cache as CacheState & { imported?: Record<string, number> }).imported ?? {};
  for (const [fid, count] of importedByForm) {
    cachedImported[fid] = (cachedImported[fid] ?? 0) + count;
  }

  // ── 6. Save updated cache ─────────────────────────────────────────────────
  const newCache: CacheState & { imported?: Record<string, number> } = {
    lastStepId: maxStepId,
    lastSrId:   maxSrId,
    forms:         Object.fromEntries(formMap),
    uuidToFormId:  Object.fromEntries(uuidToForm),
    imported:      cachedImported,
    labels:        Object.fromEntries(labelsMap),
    hidden:        Array.from(hiddenSet),
  };

  await ourDb
    .from('videoask_import_configs')
    .upsert(
      { form_title: CACHE_KEY, column_mappings: newCache, static_values: {} },
      { onConflict: 'form_title' }
    );

  // ── 7. Build response ─────────────────────────────────────────────────────
  const forms = Array.from(formMap.entries())
    .filter(([formId]) => !hiddenSet.has(formId))
    .map(([formId, { total, sampleTitle, formName }]) => {
      const imported = cachedImported[formId] ?? 0;
      const customLabel = labelsMap.get(formId) ?? null;
      return { formId, formName, customLabel, sampleTitle, totalSteps: total, imported, isImported: imported > 0 };
    })
    .sort((a, b) => {
      if (a.isImported !== b.isImported) return a.isImported ? 1 : -1;
      return b.totalSteps - a.totalSteps;
    });

  return NextResponse.json({ forms });
}

// PATCH /api/admin/videoask-import/discover
// body: { action: 'rename', formId: string, label: string }
//     | { action: 'delete', formId: string }
export async function PATCH(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { action: string; formId: string; label?: string };
  const { action, formId } = body;
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const ourDb = getSupabaseAdmin();
  const { data: cacheRow } = await ourDb
    .from('videoask_import_configs')
    .select('column_mappings')
    .eq('form_title', CACHE_KEY)
    .maybeSingle();

  const cache = (cacheRow?.column_mappings ?? {}) as CacheState & { imported?: Record<string, number> };
  const labels = { ...(cache.labels ?? {}) };
  const hidden = new Set<string>(cache.hidden ?? []);

  if (action === 'rename') {
    const label = (body.label ?? '').trim();
    if (label) labels[formId] = label;
    else delete labels[formId];
  } else if (action === 'delete') {
    hidden.add(formId);
  } else if (action === 'reset_cache') {
    // Clear cursor positions so the next GET does a full re-scan
    const updated = { ...cache, lastStepId: '00000000-0000-0000-0000-000000000000', lastSrId: 0 };
    await ourDb
      .from('videoask_import_configs')
      .upsert({ form_title: CACHE_KEY, column_mappings: updated, static_values: {} }, { onConflict: 'form_title' });
    return NextResponse.json({ ok: true });
  } else if (action === 'add_form') {
    // Manually add a form ID that discover missed (e.g. steps have null form_id, or cache gap)
    const forms = { ...(cache.forms ?? {}) };
    if (!forms[formId]) forms[formId] = { total: 0, sampleTitle: null, formName: null };
    // Also un-hide it in case it was previously deleted
    hidden.delete(formId);
    const updated = { ...cache, forms, labels, hidden: Array.from(hidden) };
    await ourDb
      .from('videoask_import_configs')
      .upsert({ form_title: CACHE_KEY, column_mappings: updated, static_values: {} }, { onConflict: 'form_title' });
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const updated = { ...cache, labels, hidden: Array.from(hidden) };
  await ourDb
    .from('videoask_import_configs')
    .upsert({ form_title: CACHE_KEY, column_mappings: updated, static_values: {} }, { onConflict: 'form_title' });

  return NextResponse.json({ ok: true });
}
