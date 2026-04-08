import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/raw-sample?formId=...&nodeId=...
// Returns the raw JSONB from a few steps so we can see exactly what VideoAsk stores
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  const nodeId = searchParams.get('nodeId');
  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  let query = impacter
    .schema('videoask')
    .from('steps')
    .select('id, interaction_id, node_id, node_title, transcript, raw')
    .eq('form_id', formId)
    .limit(5);

  if (nodeId) query = query.eq('node_id', nodeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ samples: data ?? [] });
}
