import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .select(`*, questions ( * )`)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order } = body;

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .insert({ id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert questions if provided
  if (body.questions?.length) {
    await supabaseAdmin.from('questions').insert(
      body.questions.map((q: {
        id: string; title: string; sort_order: number;
        embed_url: string; spanish_embed_url?: string; text_embed_url?: string;
      }) => ({
        id: q.id,
        assessment_id: id,
        sort_order: q.sort_order,
        title: q.title,
        embed_url: q.embed_url,
        spanish_embed_url: q.spanish_embed_url || null,
        text_embed_url: q.text_embed_url || null,
      })),
    );
  }

  return NextResponse.json(data, { status: 201 });
}
