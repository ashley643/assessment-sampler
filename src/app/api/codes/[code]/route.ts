import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AccessCode } from '@/types/assessment';

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const { data, error } = await supabaseAdmin
    .from('access_codes')
    .select(`
      id, code, label, starts_at, expires_at, is_active,
      code_assessments (
        sort_order,
        assessments (
          id, title, type, type_label, accent_color, badge_bg, badge_text, description,
          questions ( id, sort_order, title, embed_url, spanish_embed_url, text_embed_url )
        )
      )
    `)
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  }

  // Validate active + date range
  const now = new Date();
  if (!data.is_active) {
    return NextResponse.json({ error: 'Code is inactive' }, { status: 403 });
  }
  if (data.expires_at && new Date(data.expires_at) < now) {
    return NextResponse.json({ error: 'Code has expired' }, { status: 403 });
  }
  if (data.starts_at && new Date(data.starts_at) > now) {
    return NextResponse.json({ error: 'Code is not yet active' }, { status: 403 });
  }

  // Normalize to camelCase AccessCode shape
  const sorted = ((data.code_assessments as unknown) as {
    sort_order: number;
    assessments: {
      id: string;
      title: string;
      type: string;
      type_label: string;
      accent_color: string;
      badge_bg: string;
      badge_text: string;
      description: string;
      questions: {
        id: string;
        sort_order: number;
        title: string;
        embed_url: string;
        spanish_embed_url: string | null;
        text_embed_url: string | null;
      }[];
    };
  }[]).sort((a, b) => a.sort_order - b.sort_order);

  const normalized: AccessCode = {
    code: data.code,
    expires: data.expires_at ?? '',
    label: data.label,
    assessments: sorted.map(ca => ({
      id: ca.assessments.id,
      title: ca.assessments.title,
      type: ca.assessments.type,
      typeLabel: ca.assessments.type_label,
      accentColor: ca.assessments.accent_color,
      badgeBg: ca.assessments.badge_bg,
      badgeText: ca.assessments.badge_text,
      description: ca.assessments.description,
      questions: ca.assessments.questions
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(q => ({
          id: q.id,
          order: q.sort_order,
          title: q.title,
          embedUrl: q.embed_url,
          spanishEmbedUrl: q.spanish_embed_url ?? undefined,
          textEmbedUrl: q.text_embed_url ?? undefined,
        })),
    })),
  };

  return NextResponse.json(normalized);
}
