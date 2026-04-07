import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getImpacterClient } from '@/lib/impacter-client';

// Sentinel district name used to store sync cursor in district_school_index.
// Filtered out in the GET /api/admin/district-index response.
const SYNC_CURSOR_KEY = '__sync_cursor__';

// Rows without a district_name are grouped under this label in the sidebar.
export const NO_DISTRICT = '(No District)';

// POST /api/admin/district-index/sync
// Full cursor-based scan of student_responses every time.
// Cursor-based (id > lastId ORDER BY id) is O(log n) per page — fast even
// at 200k rows. We can't use an incremental cursor because UPDATE operations
// don't change row IDs, so updated rows would be missed by a position cursor.
export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ourDb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joshDb = getImpacterClient() as any;

  // ── Step 1: Load pairs we already know about ──────────────────────────────
  const { data: existing, error: existErr } = await ourDb
    .from('district_school_index')
    .select('district_name, school_name')
    .neq('district_name', SYNC_CURSOR_KEY);

  if (existErr && existErr.code !== '42P01') {
    return NextResponse.json({ error: existErr.message }, { status: 500 });
  }

  type Pair = { district_name: string; school_name: string };
  const knownPairs = new Set<string>(
    ((existing ?? []) as Pair[]).map(r => `${r.district_name}|||${r.school_name}`)
  );

  // ── Step 2: Full cursor-based scan of student_responses ───────────────────
  // Cursor-based (id > lastId) avoids the O(offset) slowdown of OFFSET queries.
  const newPairs: Pair[] = [];
  let cursorId = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await joshDb
      .from('student_responses')
      .select('id, district_name, school_name')
      .gt('id', cursorId)
      .order('id', { ascending: true })
      .limit(PAGE);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as { id: number; district_name: string | null; school_name: string | null }[];

    for (const r of rows) {
      const districtName = r.district_name?.trim() || NO_DISTRICT;
      const schoolName   = r.school_name?.trim()   || null;
      if (!schoolName) continue;

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
  return NextResponse.json({ added, total });
}
