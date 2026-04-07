import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getImpacterClient } from '@/lib/impacter-client';

// POST /api/admin/district-index/sync
// Scans Josh's student_responses table for (district_name, school_name) pairs
// not yet in our district_school_index, then inserts them.
// Returns { added, total } counts.
export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ourDb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const joshDb = getImpacterClient() as any;

  // ── Step 1: Load what we already have ────────────────────────────────────
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

  // ── Step 2: Scan Josh's table for all distinct (district, school) pairs ──
  const newPairs: Pair[] = [];
  const PAGE = 1000;
  let from = 0;
  let keepGoing = true;

  while (keepGoing) {
    const { data, error } = await joshDb
      .from('student_responses')
      .select('district_name, school_name')
      .order('district_name', { ascending: true })
      .order('school_name',   { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Pair[];
    for (const r of rows) {
      if (!r.district_name || !r.school_name) continue;
      const key = `${r.district_name}|||${r.school_name}`;
      if (!knownPairs.has(key)) {
        knownPairs.add(key);  // deduplicate within this scan too
        newPairs.push({ district_name: r.district_name, school_name: r.school_name });
      }
    }

    keepGoing = rows.length === PAGE && from < 200000;
    from += PAGE;
  }

  // ── Step 3: Insert new pairs ──────────────────────────────────────────────
  let added = 0;
  if (newPairs.length > 0) {
    // Insert in chunks of 500 to avoid request size limits
    const CHUNK = 500;
    for (let i = 0; i < newPairs.length; i += CHUNK) {
      const chunk = newPairs.slice(i, i + CHUNK);
      const { error: insertErr } = await ourDb
        .from('district_school_index')
        .upsert(chunk, { onConflict: 'district_name,school_name', ignoreDuplicates: true });

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      added += chunk.length;
    }
  }

  const total = (existing?.length ?? 0) + added;
  return NextResponse.json({ added, total });
}
