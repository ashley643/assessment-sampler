import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

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
// plus a nodes array listing every distinct node in the form.
// Import status check is skipped (too slow) — use the dry-run for that.
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // Fetch all steps for this form to build the nodes list
  const { data, error } = await impacter
    .schema('videoask')
    .from('steps')
    .select('id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
    .eq('form_id', formId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allSteps = (data ?? []) as Record<string, unknown>[];

  // Build node list
  const nodeMap = new Map<string, NodeInfo>();
  for (const step of allSteps) {
    const nodeId = String(step.node_id ?? '');
    if (!nodeId) continue;
    const raw = (step.raw ?? {}) as Record<string, unknown>;
    const pollOptions = raw.poll_options as Array<{ content?: string; label?: string }> | undefined;
    const pollLabel = (typeof raw.poll_option_content === 'string' ? raw.poll_option_content : null)
      ?? pollOptions?.[0]?.content ?? pollOptions?.[0]?.label ?? null;

    const existing = nodeMap.get(nodeId);
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
      if (existing.sampleTranscript === null && step.transcript != null) existing.sampleTranscript = String(step.transcript);
      if (existing.samplePollOption === null && pollLabel) existing.samplePollOption = String(pollLabel);
    }
  }

  const nodes = Array.from(nodeMap.values());

  // 3 sample rows for display
  const flatRows = allSteps.slice(0, 3).map(r => {
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

  return NextResponse.json({
    rows: flatRows,
    columns: flatRows.length > 0 ? Object.keys(flatRows[0]) : [],
    totalSteps: allSteps.length,
    nodes,
  });
}
