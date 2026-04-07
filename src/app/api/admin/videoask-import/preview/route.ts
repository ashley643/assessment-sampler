import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/preview?formId=...
// Returns sample rows from videoask.steps for a given form_id,
// plus the list of available columns.
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  const { data, error } = await impacter
    .schema('videoask')
    .from('steps')
    .select('id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
    .eq('form_id', formId)
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Record<string, unknown>[];

  // For display, flatten a few useful raw sub-fields
  const flatRows = rows.map(r => {
    const raw = (r.raw ?? {}) as Record<string, unknown>;
    return {
      id:           r.id,
      form_id:      r.form_id,
      node_title:   r.node_title,
      node_text:    r.node_text,
      media_type:   r.media_type,
      media_url:    r.media_url,
      share_url:    r.share_url,
      transcript:   r.transcript,
      created_at:   r.created_at,
      contact_email: raw.contact_email ?? null,
      form_share_id: raw.form_share_id ?? null,
    };
  });

  const columns = flatRows.length > 0 ? Object.keys(flatRows[0]) : [];

  return NextResponse.json({ rows: flatRows, columns });
}
