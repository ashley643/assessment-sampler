import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const days = parseInt(searchParams.get('days') ?? '30', 10);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Sessions
  let sessionsQuery = supabaseAdmin
    .from('sessions')
    .select('*', { count: 'exact' })
    .gte('started_at', since);
  if (code) sessionsQuery = sessionsQuery.eq('code', code);
  const { count: sessionCount } = await sessionsQuery;

  // All events unfiltered — used for the full code list
  const { data: allEvents } = await supabaseAdmin
    .from('events')
    .select('code')
    .gte('created_at', since);

  const byCode: Record<string, number> = {};
  for (const ev of allEvents ?? []) {
    byCode[ev.code] = (byCode[ev.code] ?? 0) + 1;
  }

  // Events filtered by selected code — used for all other metrics
  let eventsQuery = supabaseAdmin
    .from('events')
    .select('event_type, assessment_id, question_id, code, created_at')
    .gte('created_at', since);
  if (code) eventsQuery = eventsQuery.eq('code', code);
  const { data: events } = await eventsQuery;

  // Look up assessment titles
  const allIds = [...new Set((events ?? []).map(e => e.assessment_id).filter(Boolean))];
  const { data: assessments } = allIds.length
    ? await supabaseAdmin.from('assessments').select('id, title').in('id', allIds)
    : { data: [] };
  const titleMap: Record<string, string> = {};
  for (const a of assessments ?? []) titleMap[a.id] = a.title;

  // Also resolve any IDs not found in assessments against the bundles table
  const unresolvedIds = allIds.filter(id => !titleMap[id]);
  const { data: bundles } = unresolvedIds.length
    ? await supabaseAdmin.from('bundles').select('id, title').in('id', unresolvedIds)
    : { data: [] };
  for (const b of bundles ?? []) titleMap[b.id] = b.title;

  // Helper: return best human-readable label for an assessment_id
  function resolveLabel(id: string): string {
    if (titleMap[id]) return titleMap[id];
    // Clean up raw slugs/IDs as a last resort
    return id.replace(/^bundle-\d+$/, 'Unknown bundle').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Aggregate filtered events by type and assessment
  const byType: Record<string, number> = {};
  const byAssessment: Record<string, number> = {};

  for (const ev of events ?? []) {
    byType[ev.event_type] = (byType[ev.event_type] ?? 0) + 1;
    if (ev.assessment_id) {
      const label = resolveLabel(ev.assessment_id);
      byAssessment[label] = (byAssessment[label] ?? 0) + 1;
    }
  }

  // Daily sessions for chart
  const dailyMap: Record<string, number> = {};
  let dailyQuery = supabaseAdmin
    .from('sessions')
    .select('started_at')
    .gte('started_at', since);
  if (code) dailyQuery = dailyQuery.eq('code', code);
  const { data: dailySessions } = await dailyQuery;

  for (const s of dailySessions ?? []) {
    const day = s.started_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    sessions: sessionCount ?? 0,
    events: events?.length ?? 0,
    byType,
    byAssessment,
    byCode,
    daily,
  });
}
