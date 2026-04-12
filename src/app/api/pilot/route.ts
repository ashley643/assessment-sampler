import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';
import { sendReceiptEmail, sendInternalNotification } from '@/lib/pilot-emails';

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
    primaryGoalOther,
    competencyFocus,
    screeningScope,
    languages,
    otherLanguage,
    modalities,
    demographics,
    demographicsOther,
    bhSelectedAssessments,
    bhWantsCustom,
    lpSelectedAssessments,
    lpWantsCustom,
    csSelections,
    bhSelections,
    lpSelections,
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
      primaryGoalOther: primaryGoalOther || null,
      competencyFocus: competencyFocus || null,
      screeningScope: screeningScope || null,
      languages: languages?.length ? languages : null,
      otherLanguage: otherLanguage || null,
      modalities: modalities?.length ? modalities : null,
      demographics: demographics?.length ? demographics : null,
      demographicsOther: demographicsOther || null,
      bhSelectedAssessments: bhSelectedAssessments?.length ? bhSelectedAssessments : null,
      bhWantsCustom: bhWantsCustom || null,
      lpSelectedAssessments: lpSelectedAssessments?.length ? lpSelectedAssessments : null,
      lpWantsCustom: lpWantsCustom || null,
      csSelections: csSelections ?? null,
      bhSelections: bhSelections ?? null,
      lpSelections: lpSelections ?? null,
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

  // Send emails if Resend is configured
  if (process.env.RESEND_API_KEY) {
    await Promise.allSettled([
      sendReceiptEmail({ name, email, organization, assessmentType, launchTimeline, expectedCount }),
      sendInternalNotification({
        name, email, role, organization, phone,
        assessmentType, launchTimeline, expectedCount,
        respondents, gradeLevels, primaryGoal, communityModel,
        competencyFocus, screeningScope, notes,
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

export async function DELETE(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabaseAdmin.from('pilot_intake').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('pilot_intake')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
