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
          id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order,
          questions ( id, sort_order, title, embed_url, spanish_embed_url )
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
      sort_order: number;
      questions: {
        id: string;
        sort_order: number;
        title: string;
        embed_url: string;
        spanish_embed_url: string | null;
      }[];
    };
  }[]).sort((a, b) => a.assessments.sort_order - b.assessments.sort_order);

  function normalizeQuestions(questions: { id: string; sort_order: number; title: string; embed_url: string; spanish_embed_url: string | null }[]) {
    return questions
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(q => ({
        id: q.id,
        order: q.sort_order,
        title: q.title,
        embedUrl: q.embed_url,
        spanishEmbedUrl: q.spanish_embed_url ?? undefined,
      }));
  }

  // For benchmark_group assessments, fetch child assessments by question IDs
  const assessmentList = await Promise.all(sorted.map(async ca => {
    const a = ca.assessments;
    const base = {
      id: a.id,
      title: a.title,
      type: a.type,
      typeLabel: a.type_label,
      accentColor: a.accent_color,
      badgeBg: a.badge_bg,
      badgeText: a.badge_text,
      description: a.description,
      questions: normalizeQuestions(a.questions),
    };

    if (a.type === 'benchmark_group') {
      const childIds = a.questions.map((q: { id: string }) => q.id);
      const { data: children } = await supabaseAdmin
        .from('assessments')
        .select('id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order, questions ( id, sort_order, title, embed_url, spanish_embed_url )')
        .in('id', childIds);

      return {
        ...base,
        childAssessments: (children ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(child => ({
            id: child.id,
            title: child.title,
            type: child.type,
            typeLabel: child.type_label,
            accentColor: child.accent_color,
            badgeBg: child.badge_bg,
            badgeText: child.badge_text,
            description: child.description,
            questions: normalizeQuestions(child.questions),
          })),
      };
    }

    return base;
  }));

  const normalized: AccessCode = {
    code: data.code,
    expires: data.expires_at ?? '',
    label: data.label,
    assessments: assessmentList,
  };

  return NextResponse.json(normalized);
}
