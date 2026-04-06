import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { questionId, language, embedUrl, mediaType, grade, gender: rawGender, excerpt, feature } = await req.json();

  // Normalise legacy "male"/"female" → "M"/"F"
  const genderMap: Record<string, string> = { male: 'M', female: 'F', 'm': 'M', 'f': 'F' };
  const gender = rawGender ? (genderMap[rawGender.toLowerCase().trim()] ?? rawGender.trim()) : rawGender;

  if (!questionId || !language || !embedUrl) {
    return NextResponse.json({ error: 'questionId, language, and embedUrl are required' }, { status: 400 });
  }

  // Compute the sort_order to use:
  // feature=true → insert before all existing samples of this language (min - 1)
  // feature=false → append after all existing samples (max + 1)
  const { data: existingOrders } = await supabaseAdmin
    .from('question_samples')
    .select('sort_order')
    .eq('question_id', questionId)
    .order('sort_order', { ascending: true });

  const orders = (existingOrders ?? []).map(r => r.sort_order as number);
  const sortOrder = feature
    ? (orders.length > 0 ? orders[0] - 1 : 0)
    : (orders.length > 0 ? orders[orders.length - 1] + 1 : 0);

  // If this embed URL is already assigned somewhere, UPDATE it in-place (preserve ID so bookmarks stay valid).
  // Use exact match on the full URL, then fall back to the URL without query params — never use LIKE
  // which can accidentally match other samples and cause deletions.
  const normalisedUrl = embedUrl.split('?')[0];
  let dupId: string | null = null;

  const { data: exact } = await supabaseAdmin
    .from('question_samples').select('id').eq('embed_url', embedUrl).limit(1);
  if (exact && exact.length > 0) {
    dupId = exact[0].id as string;
  } else if (normalisedUrl !== embedUrl) {
    const { data: norm } = await supabaseAdmin
      .from('question_samples').select('id').eq('embed_url', normalisedUrl).limit(1);
    if (norm && norm.length > 0) dupId = norm[0].id as string;
  }

  if (dupId) {
    const { error } = await supabaseAdmin.from('question_samples').update({
      question_id: questionId,
      embed_url:   embedUrl,
      language:    language,
      media_type:  mediaType ?? 'video',
      sort_order:  sortOrder,
      gender:      gender?.trim()  || null,
      grade:       grade?.trim()   || null,
      excerpt:     excerpt?.trim() || null,
    }).eq('id', dupId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'updated', id: dupId });
  }

  // New sample
  const nextOrder = sortOrder;

  const { error } = await supabaseAdmin.from('question_samples').insert({
    question_id:  questionId,
    embed_url:    embedUrl,
    language:     language,
    media_type:   mediaType ?? 'video',
    sort_order:   nextOrder,
    gender:       gender?.trim()  || null,
    grade:        grade?.trim()   || null,
    excerpt:      excerpt?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH — edit an existing sample (embed URL, metadata, or reassign to different question)
export async function PATCH(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sampleId, questionId, language, embedUrl, mediaType, grade, gender: rawGender, excerpt } = await req.json();
  if (!sampleId) return NextResponse.json({ error: 'sampleId is required' }, { status: 400 });

  const genderMap: Record<string, string> = { male: 'M', female: 'F', 'm': 'M', 'f': 'F' };
  const gender = rawGender ? (genderMap[rawGender.toLowerCase().trim()] ?? rawGender.trim()) : rawGender;

  const updates: Record<string, unknown> = {};
  if (questionId  !== undefined) updates.question_id = questionId;
  if (language    !== undefined) updates.language    = language;
  if (embedUrl    !== undefined) updates.embed_url   = embedUrl;
  if (mediaType   !== undefined) updates.media_type  = mediaType;
  if (grade       !== undefined) updates.grade       = grade?.trim()   || null;
  if (gender      !== undefined) updates.gender      = gender?.trim()  || null;
  if (excerpt     !== undefined) updates.excerpt     = excerpt?.trim() || null;

  const { error } = await supabaseAdmin.from('question_samples').update(updates).eq('id', sampleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { embedUrl } = await req.json();
  if (!embedUrl) return NextResponse.json({ error: 'embedUrl is required' }, { status: 400 });

  // Exact match only — LIKE can collide with other samples sharing a URL prefix
  const { error } = await supabaseAdmin
    .from('question_samples')
    .delete()
    .eq('embed_url', embedUrl);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
