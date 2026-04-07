import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/district-index
// Loads the cached district/school list from our own Supabase.
// Returns { districts, needsSync } where needsSync=true means the table is
// empty or doesn't exist yet — show the sync button.
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabaseAdmin();

  const { data, error } = await db
    .from('district_school_index')
    .select('district_name, school_name')
    .order('district_name')
    .order('school_name');

  if (error) {
    // Table doesn't exist yet (42P01 = undefined_table)
    if (error.code === '42P01') {
      return NextResponse.json({ districts: [], needsSync: true, notSetUp: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = { district_name: string; school_name: string };
  const rows = (data ?? []) as Row[];

  const districtMap: Record<string, Set<string>> = {};
  for (const r of rows) {
    if (!districtMap[r.district_name]) districtMap[r.district_name] = new Set();
    if (r.school_name) districtMap[r.district_name].add(r.school_name);
  }

  const districts = Object.entries(districtMap)
    .map(([name, schools]) => ({ name, schools: Array.from(schools).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ districts, needsSync: districts.length === 0 });
}
