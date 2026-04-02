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

  // Events breakdown
  let eventsQuery = supabaseAdmin
    .from('events')
    .select('event_type, assessment_id, question_id, code, created_at')
    .gte('created_at', since);
  if (code) eventsQuery = eventsQuery.eq('code', code);
  const { data: events } = await eventsQuery;

  // Aggregate by event type
  const byType: Record<string, number> = {};
  const byAssessment: Record<string, number> = {};
  const byCode: Record<string, number> = {};

  for (const ev of events ?? []) {
    byType[ev.event_type] = (byType[ev.event_type] ?? 0) + 1;
    if (ev.assessment_id) {
      byAssessment[ev.assessment_id] = (byAssessment[ev.assessment_id] ?? 0) + 1;
    }
    byCode[ev.code] = (byCode[ev.code] ?? 0) + 1;
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
