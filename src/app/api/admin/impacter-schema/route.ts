import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

// Temporary discovery route — hit GET /api/admin/impacter-schema to see
// all tables + columns available in the Impacter Supabase.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const impacter = getImpacterClient();

  // 1. List all schemas and tables
  const { data: tables, error: tErr } = await (impacter as unknown as {
    from: (t: string) => { select: (c: string) => { not: (c: string, op: string, v: string) => { order: (c: string) => { order: (c: string) => Promise<{data: unknown[], error: unknown}> } } } }
  }).from('information_schema.tables')
    .select('table_schema, table_name, table_type')
    .not('table_schema', 'in', '(pg_catalog,pg_toast)')
    .order('table_schema')
    .order('table_name');

  if (tErr) {
    // information_schema might be blocked — fall back to a direct table probe
    return NextResponse.json({ error: 'information_schema not accessible', detail: String(tErr) });
  }

  // 2. List all columns
  const { data: columns } = await (impacter as unknown as {
    from: (t: string) => { select: (c: string) => { not: (c: string, op: string, v: string) => { order: (c: string) => { order: (c: string) => { order: (c: string) => Promise<{data: unknown[]}> } } } } }
  }).from('information_schema.columns')
    .select('table_schema, table_name, column_name, data_type, ordinal_position')
    .not('table_schema', 'in', '(pg_catalog,pg_toast)')
    .order('table_schema')
    .order('table_name')
    .order('ordinal_position');

  // Group columns by schema.table
  type ColRow = { table_schema: string; table_name: string; column_name: string; data_type: string };
  const byTable: Record<string, string[]> = {};
  for (const col of (columns ?? []) as ColRow[]) {
    const key = `${col.table_schema}.${col.table_name}`;
    if (!byTable[key]) byTable[key] = [];
    byTable[key].push(`${col.column_name} (${col.data_type})`);
  }

  // 3. For tables outside information_schema, grab one sample row
  type TableRow = { table_schema: string; table_name: string };
  const samples: Record<string, unknown> = {};
  for (const t of (tables ?? []) as TableRow[]) {
    if (t.table_schema === 'information_schema') continue;
    try {
      const { data } = await impacter
        .schema(t.table_schema as 'public')
        .from(t.table_name)
        .select('*')
        .limit(1);
      samples[`${t.table_schema}.${t.table_name}`] = data?.[0] ?? null;
    } catch (e) {
      samples[`${t.table_schema}.${t.table_name}`] = `error: ${e}`;
    }
  }

  return NextResponse.json({ tables, columnsByTable: byTable, sampleRows: samples });
}
