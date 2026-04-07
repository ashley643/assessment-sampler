import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

const IMPACTER_URL = 'https://leeevvjenekdldngwkek.supabase.co';

// Temporary discovery route — fetches the PostgREST OpenAPI spec which lists
// every accessible table + column in the Impacter Supabase.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = process.env.IMPACTER_SERVICE_ROLE_KEY!;

  // PostgREST exposes a full OpenAPI spec at /rest/v1/ — includes all schemas,
  // tables, and column definitions the service role can access.
  const specRes = await fetch(`${IMPACTER_URL}/rest/v1/`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/openapi+json',
    },
  });

  if (!specRes.ok) {
    return NextResponse.json({ error: `OpenAPI fetch failed: ${specRes.status}`, body: await specRes.text() });
  }

  const spec = await specRes.json() as {
    definitions?: Record<string, { properties?: Record<string, { type?: string; format?: string; description?: string }> }>;
    paths?: Record<string, unknown>;
  };

  // Extract table → columns map from OpenAPI definitions
  const tables: Record<string, { column: string; type: string; description?: string }[]> = {};
  for (const [name, def] of Object.entries(spec.definitions ?? {})) {
    tables[name] = Object.entries(def.properties ?? {}).map(([col, info]) => ({
      column: col,
      type: info.format ?? info.type ?? 'unknown',
      ...(info.description ? { description: info.description } : {}),
    }));
  }

  // Also grab one sample row from every table so we can see real values
  const samples: Record<string, unknown> = {};
  for (const tableName of Object.keys(tables)) {
    try {
      const r = await fetch(`${IMPACTER_URL}/rest/v1/${tableName}?limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
      });
      if (r.ok) samples[tableName] = await r.json();
    } catch { /* skip inaccessible tables */ }
  }

  return NextResponse.json({ tableCount: Object.keys(tables).length, tables, samples });
}
