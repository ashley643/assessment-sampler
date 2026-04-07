import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// GET /api/admin/videoask-import/preview?formId=...
// Returns sample rows + columns from videoask.steps for a given form_id,
// plus the import status (how many steps are already in student_responses).
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // Get all media_urls for this form (to check import status) + 5 sample rows
  const [allUrlsRes, sampleRes] = await Promise.all([
    impacter
      .schema('videoask')
      .from('steps')
      .select('media_url')
      .eq('form_id', formId),
    impacter
      .schema('videoask')
      .from('steps')
      .select('id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
      .eq('form_id', formId)
      .limit(5),
  ]);

  if (allUrlsRes.error) return NextResponse.json({ error: allUrlsRes.error.message }, { status: 500 });
  if (sampleRes.error) return NextResponse.json({ error: sampleRes.error.message }, { status: 500 });

  const allStepUrls = (allUrlsRes.data ?? []) as { media_url: string | null }[];
  const uuids = allStepUrls.map(r => extractUuid(r.media_url ?? '')).filter(Boolean) as string[];

  // Check which of this form's UUIDs are already in student_responses
  // Use ilike OR conditions — one batch query
  let importedCount = 0;
  if (uuids.length > 0) {
    const BATCH = 50;
    const batches = await Promise.all(
      Array.from({ length: Math.ceil(uuids.length / BATCH) }, (_, i) => {
        const batch = uuids.slice(i * BATCH, (i + 1) * BATCH);
        const orCond = batch.map(u => `url.ilike.%${u}%`).join(',');
        return impacter
          .from('student_responses')
          .select('id', { count: 'exact', head: true })
          .or(orCond);
      })
    );
    importedCount = batches.reduce((sum, r) => sum + (r.count ?? 0), 0);
  }

  const rows = (sampleRes.data ?? []) as Record<string, unknown>[];
  const flatRows = rows.map(r => {
    const raw = (r.raw ?? {}) as Record<string, unknown>;
    return {
      id:            r.id,
      form_id:       r.form_id,
      node_title:    r.node_title,
      node_text:     r.node_text,
      media_type:    r.media_type,
      media_url:     r.media_url,
      share_url:     r.share_url,
      transcript:    r.transcript,
      created_at:    r.created_at,
      contact_email: raw.contact_email ?? null,
      form_share_id: raw.form_share_id ?? null,
    };
  });

  const columns = flatRows.length > 0 ? Object.keys(flatRows[0]) : [];

  return NextResponse.json({
    rows: flatRows,
    columns,
    totalSteps: allStepUrls.length,
    importedSteps: importedCount,
  });
}
