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
// Only scans student_responses rows newer than the last sync (cursor-based).
// This makes repeated syncs fast regardless of table size.
export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ourDb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joshDb = getImpacterClient() as any;

  // ── Step 1: Read last synced ID from our cursor row ───────────────────────
  const { data: cursorRow } = await ourDb
    .from('district_school_index')
    .select('school_name')
    .eq('district_name', SYNC_CURSOR_KEY)
    .maybeSingle();

  const lastSyncedId: number = cursorRow ? parseInt(cursorRow.school_name, 10) || 0 : 0;

  // ── Step 2: Load pairs we already know about ──────────────────────────────
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

  // ── Step 3: Cursor-scan new rows from Josh's table ────────────────────────
  const newPairs: Pair[] = [];
  let maxSeenId = lastSyncedId;
  let cursorId = lastSyncedId;
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
      if (r.id > maxSeenId) maxSeenId = r.id;

      const districtName = r.district_name?.trim() || NO_DISTRICT;
      const schoolName   = r.school_name?.trim()   || null;
      if (!schoolName) continue; // skip rows with no school either

      const key = `${districtName}|||${schoolName}`;
      if (!knownPairs.has(key)) {
        knownPairs.add(key);
        newPairs.push({ district_name: districtName, school_name: schoolName });
      }
    }

    if (rows.length < PAGE) break;
    cursorId = rows[rows.length - 1].id;
  }

  // ── Step 4: Insert new pairs ──────────────────────────────────────────────
  let added = 0;
  if (newPairs.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < newPairs.length; i += CHUNK) {
      const { error: insertErr } = await ourDb
        .from('district_school_index')
        .upsert(newPairs.slice(i, i + CHUNK), { onConflict: 'district_name,school_name', ignoreDuplicates: true });

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      added += CHUNK;
    }
    added = newPairs.length;
  }

  // ── Step 5: Persist new cursor position ───────────────────────────────────
  // We store it as district_name=SYNC_CURSOR_KEY, school_name='cursor'.
  // The actual last_id is stored via an update since the row is stable.
  if (maxSeenId > lastSyncedId) {
    // Delete old cursor row and insert fresh one (avoids unique constraint issues)
    await ourDb
      .from('district_school_index')
      .delete()
      .eq('district_name', SYNC_CURSOR_KEY);
    await ourDb
      .from('district_school_index')
      .insert({ district_name: SYNC_CURSOR_KEY, school_name: String(maxSeenId) });
  }

  const total = (existing?.length ?? 0) + added;
  return NextResponse.json({ added, total });
}
