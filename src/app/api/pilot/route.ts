import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const {
    assessmentType,
    respondents,
    gradeLevels,
    expectedCount,
    launchTimeline,
    dateNotes,
    onsiteSupport,
    wantsCustomIntro,
    communityModel,
    primaryGoal,
    competencyFocus,
    screeningScope,
    name,
    email,
    role,
    organization,
    phone,
    notes,
  } = body;

  if (!assessmentType || !email || !name || !organization) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('pilot_intake').insert({
    assessment_type: assessmentType,
    context: {
      respondents,
      gradeLevels,
      expectedCount,
      launchTimeline,
      dateNotes: dateNotes || null,
      onsiteSupport: onsiteSupport || null,
      wantsCustomIntro: wantsCustomIntro || null,
      communityModel: communityModel || null,
      primaryGoal: primaryGoal || null,
      competencyFocus: competencyFocus || null,
      screeningScope: screeningScope || null,
    },
    contact_name: name,
    contact_email: email,
    contact_role: role || null,
    contact_org: organization,
    contact_phone: phone || null,
    notes: notes || null,
  });

  if (error) {
    console.error('pilot_intake insert error:', error);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  // TODO: Send confirmation email to contact + team when an email service is configured.
  // Example payload available: { name, email, assessmentType, organization, launchTimeline }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const cookie = req.headers.get('cookie') ?? '';
  if (!cookie.includes('admin_session')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.stage) {
    return NextResponse.json({ error: 'Missing id or stage' }, { status: 400 });
  }

  // Read existing context so we can merge the stage in without losing other fields
  const { data: row } = await supabaseAdmin
    .from('pilot_intake')
    .select('context')
    .eq('id', body.id)
    .single();

  const { error } = await supabaseAdmin
    .from('pilot_intake')
    .update({ context: { ...(row?.context ?? {}), stage: body.stage } })
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  // Admin-only listing — simple cookie check
  const cookie = req.headers.get('cookie') ?? '';
  if (!cookie.includes('admin_session')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('pilot_intake')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
