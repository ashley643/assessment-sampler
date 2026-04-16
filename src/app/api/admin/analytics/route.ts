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

  // All sessions unfiltered — used for the full code list
  const { data: allSessions } = await supabaseAdmin
    .from('sessions')
    .select('code')
    .gte('started_at', since);

  const byCode: Record<string, number> = {};
  for (const s of allSessions ?? []) {
    byCode[s.code] = (byCode[s.code] ?? 0) + 1;
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
  const { data: assessmentRows } = allIds.length
    ? await supabaseAdmin.from('assessments').select('id, title').in('id', allIds)
    : { data: [] };
  const assessmentTitleMap: Record<string, string> = {};
  for (const a of assessmentRows ?? []) assessmentTitleMap[a.id] = a.title;

  // Resolve bundle IDs separately
  const unresolvedIds = allIds.filter(id => !assessmentTitleMap[id]);
  const { data: bundleRows } = unresolvedIds.length
    ? await supabaseAdmin.from('bundles').select('id, title').in('id', unresolvedIds)
    : { data: [] };
  const bundleTitleMap: Record<string, string> = {};
  for (const b of bundleRows ?? []) bundleTitleMap[b.id] = b.title;

  // Aggregate filtered events by type, assessment, and bundle separately
  const byType: Record<string, number> = {};
  const byAssessment: Record<string, number> = {};
  const byBundle: Record<string, number> = {};
  const bundleByCode: Record<string, Record<string, number>> = {};

  for (const ev of events ?? []) {
    byType[ev.event_type] = (byType[ev.event_type] ?? 0) + 1;
    if (ev.assessment_id) {
      if (assessmentTitleMap[ev.assessment_id]) {
        const label = assessmentTitleMap[ev.assessment_id];
        byAssessment[label] = (byAssessment[label] ?? 0) + 1;
      } else if (bundleTitleMap[ev.assessment_id]) {
        const label = bundleTitleMap[ev.assessment_id];
        byBundle[label] = (byBundle[label] ?? 0) + 1;
        if (!bundleByCode[label]) bundleByCode[label] = {};
        bundleByCode[label][ev.code] = (bundleByCode[label][ev.code] ?? 0) + 1;
      }
    }
  }

  // Daily sessions for chart
  const dailyMap: Record<string, number> = {};
  let dailyQuery = supabaseAdmin
    .from('sessions')
    .select('started_at, code')
    .gte('started_at', since);
  if (code) dailyQuery = dailyQuery.eq('code', code);
  const { data: dailySessions } = await dailyQuery;

  const dailyByCode: Record<string, Record<string, number>> = {};
  for (const s of dailySessions ?? []) {
    const day = s.started_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
    if (!dailyByCode[day]) dailyByCode[day] = {};
    dailyByCode[day][s.code] = (dailyByCode[day][s.code] ?? 0) + 1;
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    sessions: sessionCount ?? 0,
    events: events?.length ?? 0,
    byType,
    byAssessment,
    byBundle,
    byCode,
    daily,
    dailyByCode,
    bundleByCode,
  });
}
