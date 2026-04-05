import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AccessCode, QuestionSample } from '@/types/assessment';

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const { data, error } = await supabaseAdmin
    .from('access_codes')
    .select(`
      id, code, label, starts_at, expires_at, is_active, can_view_samples,
      code_assignments (
        sort_order,
        assessment_id,
        bundle_id,
        assessments (
          id, title, type, type_label, accent_color, badge_bg, badge_text, description, player_label, sort_order,
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
  if (!data.is_active) return NextResponse.json({ error: 'Code is inactive' }, { status: 403 });
  if (data.expires_at && new Date(data.expires_at) < now) return NextResponse.json({ error: 'Code has expired' }, { status: 403 });
  if (data.starts_at && new Date(data.starts_at) > now) return NextResponse.json({ error: 'Code is not yet active' }, { status: 403 });

  type RawQuestion = { id: string; sort_order: number; title: string; embed_url: string; spanish_embed_url: string | null };
  type RawAssessment = {
    id: string; title: string; type: string; type_label: string;
    accent_color: string; badge_bg: string; badge_text: string;
    description: string; player_label: string | null; sort_order: number;
    questions: RawQuestion[];
  };

  function normalizeQuestions(questions: RawQuestion[]) {
    return (questions ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(q => ({
        id: q.id,
        order: q.sort_order,
        title: q.title,
        embedUrl: q.embed_url,
        spanishEmbedUrl: q.spanish_embed_url ?? undefined,
      }));
  }

  function normalizeAssessment(a: RawAssessment) {
    return {
      id: a.id, title: a.title, type: a.type, typeLabel: a.type_label,
      accentColor: a.accent_color, badgeBg: a.badge_bg, badgeText: a.badge_text,
      description: a.description, playerLabel: a.player_label ?? undefined, questions: normalizeQuestions(a.questions),
    };
  }

  type RawCodeAssessment = {
    sort_order: number;
    assessment_id: string | null;
    bundle_id: string | null;
    assessments: RawAssessment | null;
  };

  const sorted = ((data.code_assignments as unknown) as RawCodeAssessment[])
    .sort((a, b) => a.sort_order - b.sort_order);

  const bundleIds = sorted.filter(ca => ca.bundle_id).map(ca => ca.bundle_id as string);

  const bundleMap = new Map<string, {
    id: string; title: string; description: string | null;
    accent_color: string; badge_bg: string; badge_text: string;
    childAssessments: ReturnType<typeof normalizeAssessment>[];
  }>();

  if (bundleIds.length > 0) {
    const { data: bundles } = await supabaseAdmin
      .from('bundles')
      .select(`
        id, title, description, accent_color, badge_bg, badge_text,
        bundle_assessments (
          sort_order,
          assessments (
            id, title, type, type_label, accent_color, badge_bg, badge_text, description, player_label, sort_order,
            questions ( id, sort_order, title, embed_url, spanish_embed_url )
          )
        )
      `)
      .in('id', bundleIds);

    for (const b of bundles ?? []) {
      const childAssessments = ((b.bundle_assessments ?? []) as unknown as { sort_order: number; assessments: RawAssessment }[])
        .sort((x, y) => x.sort_order - y.sort_order)
        .map(ba => normalizeAssessment(ba.assessments));
      bundleMap.set(b.id, { ...b, childAssessments });
    }
  }

  const assessmentList = await Promise.all(sorted.map(async ca => {
    if (ca.bundle_id) {
      const b = bundleMap.get(ca.bundle_id);
      if (!b) return null;
      return {
        id: b.id, title: b.title, type: 'bundle', typeLabel: 'Bundle',
        accentColor: b.accent_color, badgeBg: b.badge_bg, badgeText: b.badge_text,
        description: b.description ?? '',
        questions: [],
        childAssessments: b.childAssessments,
      };
    }

    if (!ca.assessments) return null;
    const a = ca.assessments;
    const base = normalizeAssessment(a);

    if (a.type === 'bundle') {
      const childIds = a.questions.map(q => q.id);
      const { data: children } = await supabaseAdmin
        .from('assessments')
        .select('id, title, type, type_label, accent_color, badge_bg, badge_text, description, player_label, sort_order, questions ( id, sort_order, title, embed_url, spanish_embed_url )')
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

  const filteredList = assessmentList.filter(Boolean) as NonNullable<typeof assessmentList[number]>[];

  // Only load samples if this code has permission to view them
  const canViewSamples = data.can_view_samples !== false; // default true for legacy rows

  // Collect all question IDs across all assessments (including bundle children)
  const allQuestionIds: string[] = [];
  function collectQuestionIds(assessments: typeof filteredList) {
    for (const a of assessments) {
      for (const q of a.questions) allQuestionIds.push(q.id);
      if ('childAssessments' in a && a.childAssessments) {
        collectQuestionIds(a.childAssessments as typeof filteredList);
      }
    }
  }
  collectQuestionIds(filteredList);

  // Fetch question_samples in bulk and build a map (only if permitted)
  const sampleMap = new Map<string, QuestionSample[]>();
  if (canViewSamples && allQuestionIds.length > 0) {
    const { data: samplesData } = await supabaseAdmin
      .from('question_samples')
      .select('id, question_id, embed_url, language, sort_order, media_type, gender, grade, excerpt')
      .in('question_id', allQuestionIds)
      .order('sort_order');

    for (const s of samplesData ?? []) {
      const list = sampleMap.get(s.question_id) ?? [];
      list.push({
        id: s.id,
        embedUrl: s.embed_url,
        language: s.language as 'english' | 'spanish',
        sortOrder: s.sort_order,
        mediaType: (s.media_type ?? 'video') as 'video' | 'audio',
        gender: s.gender ?? undefined,
        grade: s.grade ?? undefined,
        excerpt: s.excerpt ?? undefined,
      });
      sampleMap.set(s.question_id, list);
    }
  }

  // Attach samples to questions
  function attachSamples<T extends { questions: { id: string }[] }>(assessment: T): T {
    return {
      ...assessment,
      questions: assessment.questions.map(q => ({
        ...q,
        samples: sampleMap.get(q.id) ?? [],
      })),
    };
  }

  const withSamples = filteredList.map(a => {
    if ('childAssessments' in a && a.childAssessments) {
      return {
        ...attachSamples(a),
        childAssessments: (a.childAssessments as typeof filteredList).map(attachSamples),
      };
    }
    return attachSamples(a);
  });

  const normalized: AccessCode = {
    code: data.code,
    expires: data.expires_at ?? '',
    label: data.label,
    canViewSamples,
    assessments: withSamples as AccessCode['assessments'],
  };

  return NextResponse.json(normalized);
}
