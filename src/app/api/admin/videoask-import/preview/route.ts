import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// GET /api/admin/videoask-import/preview?formTitle=...
// Returns sample rows from videoask.steps for a given form_title,
// plus the list of available columns.
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formTitle = searchParams.get('formTitle');
  if (!formTitle) return NextResponse.json({ error: 'formTitle required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  const { data, error } = await impacter
    .schema('videoask')
    .from('steps')
    .select('*')
    .eq('form_title', formTitle)
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return NextResponse.json({ rows, columns });
}
