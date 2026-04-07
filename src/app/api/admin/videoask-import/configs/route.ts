import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/videoask-import/configs?formId=...
// Returns saved config for a specific form (by form_id), or all configs.
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formId = searchParams.get('formId');
  const db = getSupabaseAdmin();

  if (formId) {
    const { data, error } = await db
      .from('videoask_import_configs')
      .select('*')
      .eq('form_title', formId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ config: data ?? null });
  }

  const { data, error } = await db
    .from('videoask_import_configs')
    .select('*')
    .order('form_title');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data ?? [] });
}

// POST /api/admin/videoask-import/configs
// Saves (upserts) a column mapping config for a form (keyed by form_id).
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { formId, staticValues, columnMappings } = body as {
    formId: string;
    staticValues: Record<string, string>;
    columnMappings: Record<string, string>;
  };

  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const db = getSupabaseAdmin();

  const { data, error } = await db
    .from('videoask_import_configs')
    .upsert(
      {
        form_title: formId,   // reuse form_title column as the unique key (stores form_id)
        static_values: staticValues ?? {},
        column_mappings: columnMappings ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'form_title' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
