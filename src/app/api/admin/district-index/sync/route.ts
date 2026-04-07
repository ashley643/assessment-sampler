import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getImpacterClient } from '@/lib/impacter-client';

// Rows without a district_name are grouped under this label in the sidebar.
export const NO_DISTRICT = '(No District)';

// POST /api/admin/district-index/sync
// Full cursor-based scan of student_responses every time.
// Uses id > lastId ORDER BY id (O(log n) per page via PK index, never times out).
export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ourDb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joshDb = getImpacterClient() as any;

  // ── Step 1: Load pairs we already know about ──────────────────────────────
  const { data: existing, error: existErr } = await ourDb
    .from('district_school_index')
    .select('district_name, school_name');

  if (existErr && existErr.code !== '42P01') {
    return NextResponse.json({ error: existErr.message }, { status: 500 });
  }

  type Pair = { district_name: string; school_name: string };
  const knownPairs = new Set<string>(
    ((existing ?? []) as Pair[]).map(r => `${r.district_name}|||${r.school_name}`)
  );

  // ── Step 2: Full cursor-based scan of student_responses ───────────────────
  const newPairs: Pair[] = [];
  let cursorId = 0;
  const PAGE = 1000;
  let totalScanned = 0;
  const allDistricts = new Set<string>();

  while (true) {
    const { data, error } = await joshDb
      .from('student_responses')
      .select('id, district_name, school_name')
      .gt('id', cursorId)
      .order('id', { ascending: true })
      .limit(PAGE);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as { id: number; district_name: string | null; school_name: string | null }[];
    totalScanned += rows.length;

    for (const r of rows) {
      // Skip rows with no district at all
      const districtName = r.district_name?.trim() || null;
      if (!districtName) continue;

      allDistricts.add(districtName);

      // Use empty string for null school_name — district still appears in sidebar
      // even if no individual school names are available
      const schoolName = r.school_name?.trim() ?? '';

      const key = `${districtName}|||${schoolName}`;
      if (!knownPairs.has(key)) {
        knownPairs.add(key);
        newPairs.push({ district_name: districtName, school_name: schoolName });
      }
    }

    if (rows.length < PAGE) break;
    cursorId = rows[rows.length - 1].id;
  }

  // ── Step 3: Insert new pairs ──────────────────────────────────────────────
  let added = 0;
  if (newPairs.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < newPairs.length; i += CHUNK) {
      const { error: insertErr } = await ourDb
        .from('district_school_index')
        .upsert(newPairs.slice(i, i + CHUNK), { onConflict: 'district_name,school_name', ignoreDuplicates: true });

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    added = newPairs.length;
  }

  const total = (existing?.length ?? 0) + added;
  // Return diagnostic info so we can verify what was actually found
  return NextResponse.json({
    added,
    total,
    totalScanned,
    districtsFound: Array.from(allDistricts).sort(),
  });
}
