import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const body = await req.json();
  const { session_id, code, event_type, assessment_id, question_id, metadata, user_agent, device_type } = body;

  if (!code || !event_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let sid = session_id;

  // On session_start, create a session row and return the id
  if (event_type === 'session_start' || !sid) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({ code, user_agent: user_agent ?? null, device_type: device_type ?? null })
      .select('id')
      .single();
    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
    sid = session.id;
  } else {
    // Update last_seen_at
    await supabaseAdmin
      .from('sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', sid);
  }

  // Insert event
  await supabaseAdmin.from('events').insert({
    session_id: sid,
    code,
    event_type,
    assessment_id: assessment_id ?? null,
    question_id: question_id ?? null,
    metadata: metadata ?? null,
  });

  return NextResponse.json({ session_id: sid });
}
