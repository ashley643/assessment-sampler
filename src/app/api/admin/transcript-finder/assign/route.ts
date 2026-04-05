import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { questionId, language, embedUrl, mediaType, grade, gender, excerpt } = await req.json();

  if (!questionId || !language || !embedUrl) {
    return NextResponse.json({ error: 'questionId, language, and embedUrl are required' }, { status: 400 });
  }

  // Get current max sort_order for this question
  const { data: existing } = await supabaseAdmin
    .from('question_samples')
    .select('sort_order')
    .eq('question_id', questionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;

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
