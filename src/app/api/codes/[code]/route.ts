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
        assessment_id,
        bundle_id,
        assessments (
          id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order,
          questions ( id, sort_order, title, embed_url, spanish_embed_url )
        ),
        bundles (
          id, title, description, accent_color, badge_bg, badge_text, sort_order,
          bundle_assessments (
            sort_order,
            assessments (
              id, title, type, type_label, accent_color, badge_bg, badge_text, description, sort_order,
              questions ( id, sort_order, title, embed_url, spanish_embed_url )
            )
          )
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

  type RawAssessment = {
    id: string;
    title: string;
    type: string;
    type_label: string;
    accent_color: string;
    badge_bg: string;
    badge_text: string;
    description: string;
    sort_order: number;
    questions: { id: string; sort_order: number; title: string; embed_url: string; spanish_embed_url: string | null }[];
  };

  type RawBundleAssessment = { sort_order: number; assessments: RawAssessment };

  type RawBundle = {
    id: string;
    title: string;
    description: string | null;
    accent_color: string;
    badge_bg: string;
    badge_text: string;
    sort_order: number;
    bundle_assessments: RawBundleAssessment[];
  };

  type RawCodeAssessment = {
    sort_order: number;
    assessment_id: string | null;
    bundle_id: string | null;
    assessments: RawAssessment | null;
    bundles: RawBundle | null;
  };

  const sorted = ((data.code_assessments as unknown) as RawCodeAssessment[])
    .sort((a, b) => a.sort_order - b.sort_order);

  function normalizeAssessment(a: RawAssessment) {
    return {
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
  }

  // For benchmark_group assessments, fetch child assessments by question IDs
  const assessmentList = await Promise.all(sorted.map(async ca => {
    // Bundle assignment
    if (ca.bundle_id && ca.bundles) {
      const b = ca.bundles;
      const childAssessments = [...b.bundle_assessments]
        .sort((x, y) => x.sort_order - y.sort_order)
        .map(ba => normalizeAssessment(ba.assessments));

      return {
        id: b.id,
        title: b.title,
        type: 'bundle',
        typeLabel: 'Bundle',
        accentColor: b.accent_color,
        badgeBg: b.badge_bg,
        badgeText: b.badge_text,
        description: b.description ?? '',
        questions: [],
        childAssessments,
      };
    }

    // Individual assessment assignment
    const a = ca.assessments!;
    const base = normalizeAssessment(a);

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
          .map(child => normalizeAssessment(child as RawAssessment)),
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
