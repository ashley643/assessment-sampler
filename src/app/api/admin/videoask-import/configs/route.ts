import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/videoask-import/configs?formTitle=...
// Returns saved config for a specific form, or all configs if no formTitle.
export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formTitle = searchParams.get('formTitle');
  const db = getSupabaseAdmin();

  if (formTitle) {
    const { data, error } = await db
      .from('videoask_import_configs')
      .select('*')
      .eq('form_title', formTitle)
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
// Saves (upserts) a column mapping config for a form.
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { formTitle, staticValues, columnMappings } = body as {
    formTitle: string;
    staticValues: Record<string, string>;
    columnMappings: Record<string, string>;
  };

  if (!formTitle) return NextResponse.json({ error: 'formTitle required' }, { status: 400 });

  const db = getSupabaseAdmin();

  const { data, error } = await db
    .from('videoask_import_configs')
    .upsert(
      {
        form_title: formTitle,
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
