import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/videoask-import/configs?formId=...
// Returns saved config for a specific form (by form_id), or all configs.
// nodeRoles is stored inside column_mappings as __nodeRoles to avoid migrations.
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
    if (!data) return NextResponse.json({ config: null });

    // Extract nodeRoles out of column_mappings
    const { __nodeRoles, ...columnMappings } = (data.column_mappings ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      config: {
        ...data,
        column_mappings: columnMappings,
        nodeRoles: __nodeRoles ?? null,
      },
    });
  }

  const { data, error } = await db
    .from('videoask_import_configs')
    .select('*')
    .order('form_title');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip __nodeRoles from column_mappings for each config in the list
  const configs = (data ?? []).map(row => {
    const { __nodeRoles, ...columnMappings } = (row.column_mappings ?? {}) as Record<string, unknown>;
    return {
      ...row,
      column_mappings: columnMappings,
      nodeRoles: __nodeRoles ?? null,
    };
  });

  return NextResponse.json({ configs });
}

// POST /api/admin/videoask-import/configs
// Saves (upserts) a column mapping config for a form (keyed by form_id).
// nodeRoles is stored inside column_mappings as __nodeRoles.
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { formId, staticValues, columnMappings, nodeRoles } = body as {
    formId: string;
    staticValues: Record<string, string>;
    columnMappings: Record<string, string>;
    nodeRoles?: Record<string, unknown>;
  };

  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const db = getSupabaseAdmin();

  // Store nodeRoles inside column_mappings to avoid needing a new migration
  const storedColumnMappings: Record<string, unknown> = {
    ...(columnMappings ?? {}),
    ...(nodeRoles && Object.keys(nodeRoles).length > 0 ? { __nodeRoles: nodeRoles } : {}),
  };

  const { data, error } = await db
    .from('videoask_import_configs')
    .upsert(
      {
        form_title: formId,   // reuse form_title column as the unique key (stores form_id)
        static_values: staticValues ?? {},
        column_mappings: storedColumnMappings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'form_title' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return with nodeRoles extracted for the caller's convenience
  const { __nodeRoles, ...cleanMappings } = (data.column_mappings ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    config: {
      ...data,
      column_mappings: cleanMappings,
      nodeRoles: __nodeRoles ?? null,
    },
  });
}
