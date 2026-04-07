import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

export type NodeInfo = {
  nodeId: string;
  nodeTitle: string;
  hasMedia: boolean;
  sampleTranscript: string | null;
  samplePollOption: string | null;
  count: number;
};

// GET /api/admin/videoask-import/preview?formId=...
// Returns sample rows + columns from videoask.steps for a given form_id,
// plus the import status (how many steps are already in student_responses),
// plus a nodes array listing every distinct node in the form.
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // Fetch all steps for this form (needed for nodes list + import status)
  const allStepsRes = await impacter
    .schema('videoask')
    .from('steps')
    .select('id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
    .eq('form_id', formId);

  if (allStepsRes.error) return NextResponse.json({ error: allStepsRes.error.message }, { status: 500 });

  const allSteps = (allStepsRes.data ?? []) as Record<string, unknown>[];

  // Build the nodes list from all steps
  const nodeMap = new Map<string, NodeInfo>();
  for (const step of allSteps) {
    const nodeId = String(step.node_id ?? '');
    if (!nodeId) continue;
    const existing = nodeMap.get(nodeId);
    const raw = (step.raw ?? {}) as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pollOptions = raw.poll_options as any[] | undefined;
    const pollLabel = pollOptions?.[0]?.label ?? null;

    if (!existing) {
      nodeMap.set(nodeId, {
        nodeId,
        nodeTitle: String(step.node_title ?? nodeId),
        hasMedia: step.media_url != null,
        sampleTranscript: step.transcript != null ? String(step.transcript) : null,
        samplePollOption: pollLabel ? String(pollLabel) : null,
        count: 1,
      });
    } else {
      existing.count++;
      if (!existing.hasMedia && step.media_url != null) existing.hasMedia = true;
      if (existing.sampleTranscript === null && step.transcript != null) {
        existing.sampleTranscript = String(step.transcript);
      }
      if (existing.samplePollOption === null && pollLabel) {
        existing.samplePollOption = String(pollLabel);
      }
    }
  }
  const nodes = Array.from(nodeMap.values());

  // Check which of this form's UUIDs are already in student_responses
  const uuids = allSteps
    .map(r => extractUuid(String(r.media_url ?? '')))
    .filter(Boolean) as string[];

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
    importedCount = batches.reduce((sum: number, r: { count?: number }) => sum + (r.count ?? 0), 0);
  }

  // Return only 3 sample rows for display
  const sampleSteps = allSteps.slice(0, 3);
  const flatRows = sampleSteps.map(r => {
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
    totalSteps: allSteps.length,
    importedSteps: importedCount,
    nodes,
  });
}
