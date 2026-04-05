'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import type { AccessCode, Assessment, Question, QuestionSample } from '@/types/assessment';

interface FeedItem {
  question: Question;
  sample: QuestionSample;
  assessment: Assessment;
  bundleTitle?: string;
}

type Filters = {
  bundle: string | null;
  assessment: string | null;
  language: 'english' | 'spanish' | null;
  media: 'video' | 'audio' | null;
  gender: string | null;
  grade: string | null;
};

const EMPTY_FILTERS: Filters = { bundle: null, assessment: null, language: null, media: null, gender: null, grade: null };

function applyFilters(items: FeedItem[], f: Filters): FeedItem[] {
  return items.filter(item => {
    if (f.bundle     && item.bundleTitle !== f.bundle) return false;
    if (f.assessment && item.assessment.id !== f.assessment) return false;
    if (f.language   && item.sample.language !== f.language) return false;
    if (f.media      && (item.sample.mediaType ?? 'video') !== f.media) return false;
    if (f.gender     && item.sample.gender !== f.gender) return false;
    if (f.grade      && item.sample.grade !== f.grade) return false;
    return true;
  });
}

function activeCount(f: Filters) {
  return Object.values(f).filter(Boolean).length;
}

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [codeData, setCodeData] = useState<AccessCode | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/codes/${code}`)
      .then(async res => {
        if (!res.ok) { setNotFound(true); return; }
        setCodeData(await res.json());
      })
      .catch(() => setNotFound(true));
  }, [code]);

  useEffect(() => {
    if (notFound) router.replace('/assessment');
  }, [notFound, router]);

  if (!codeData) return null;

  const allItems: FeedItem[] = [];
  function collectQuestions(questions: Question[], assessment: Assessment, bundleTitle?: string) {
    for (const q of questions) {
      for (const sample of q.samples ?? []) {
        allItems.push({ question: q, sample, assessment, bundleTitle });
      }
    }
  }
  for (const a of codeData.assessments) {
    if (a.type === 'bundle') {
      for (const child of a.childAssessments ?? []) collectQuestions(child.questions, child, a.title);
    } else {
      collectQuestions(a.questions, a);
    }
  }

  const filtered = applyFilters(allItems, filters);

  function availableValues<T extends string>(key: keyof Filters, pick: (item: FeedItem) => T | undefined): Set<T> {
    const partial = applyFilters(allItems, { ...filters, [key]: null });
    const s = new Set<T>();
    for (const item of partial) { const v = pick(item); if (v) s.add(v); }
    return s;
  }

  const availBundles     = availableValues('bundle',     i => i.bundleTitle);
  const availAssessments = availableValues('assessment', i => i.assessment.id);
  const availLanguages   = availableValues('language',   i => i.sample.language);
  const availMedia       = availableValues('media',      i => i.sample.mediaType ?? 'video');
  const availGenders     = availableValues('gender',     i => i.sample.gender);
  const availGrades      = availableValues('grade',      i => i.sample.grade);

  const bundleNames   = [...new Set(allItems.map(i => i.bundleTitle).filter(Boolean))] as string[];
  const assessments   = [...new Map(allItems.map(i => [i.assessment.id, i.assessment])).values()];
  const genders       = [...new Set(allItems.map(i => i.sample.gender).filter(Boolean))] as string[];
  const grades        = [...new Set(allItems.map(i => i.sample.grade).filter(Boolean))] as string[];
  const hasSpanish    = allItems.some(i => i.sample.language === 'spanish');

  function toggle<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => {
      const next = { ...f, [key]: f[key] === value ? null : value };
      if (key === 'bundle') next.assessment = null;
      return next;
    });
  }

  // Shared chip component
  function Chip({ label, active, available, onClick, activeClass }: {
    label: string; active: boolean; available: boolean; onClick: () => void; activeClass?: string;
  }) {
    return (
      <button
        onClick={onClick}
        disabled={!available && !active}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
          active
            ? (activeClass ?? 'bg-[#1a2744] text-white')
            : available
              ? 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              : 'bg-white border border-gray-100 text-gray-300 cursor-not-allowed'
        }`}
      >
        {label}
      </button>
    );
  }

  // Active filter pill (removable)
  function ActivePill({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
      <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-[#1a2744] text-white">
        {label}
        <button onClick={onRemove} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M1 1l6 6M7 1L1 7"/>
          </svg>
        </button>
      </span>
    );
  }

  // Desktop: labeled filter row
  function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-start gap-3">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-2 w-16 flex-shrink-0">{label}</span>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  // Desktop: group of rows with a section label
  function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">{title}</p>
        <div className="space-y-2">{children}</div>
      </div>
    );
  }

  const assessmentLabel = (id: string) => assessments.find(a => a.id === id)?.title ?? id;
  const count = activeCount(filters);

  const mediaTypeBadge = (mt: 'video' | 'audio' | undefined) =>
    mt === 'audio'
      ? { bg: '#f3f0ff', color: '#6d28d9', label: 'Audio' }
      : { bg: '#e8f0fe', color: '#1a56db', label: 'Video' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      <nav className="flex items-center justify-between px-8 py-4 flex-shrink-0" style={{ background: '#1a2744' }}>
        <Image src="/Logo_Transparent_Background.png" alt="Impacter Pathway" width={130} height={39} className="object-contain" />
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm">{codeData.label}</span>
          <span className="bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full font-mono">{code}</span>
        </div>
        <button onClick={() => router.push(`/assessment/${code}`)} className="text-white/50 hover:text-white text-sm transition-colors">
          ← Back to assessments
        </button>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sample Responses</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Nothing brings our assessments to life more than the voices of participants themselves. Hear real responses and explore how students and other stakeholders reveal the skills and mindsets our assessments are designed to uncover.</p>
        </div>

        {allItems.length > 0 && (
          <>
            {/* ── Mobile filters ─────────────────────────────────── */}
            <div className="md:hidden mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSheetOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-gray-300 shadow-sm transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M1 3h12M3 7h8M5 11h4"/>
                  </svg>
                  Filters
                  {count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#1a2744] text-white text-[10px] font-bold flex items-center justify-center">{count}</span>
                  )}
                </button>
                {/* Active filter pills */}
                {filters.bundle     && <ActivePill label={filters.bundle} onRemove={() => toggle('bundle', filters.bundle)} />}
                {filters.assessment && <ActivePill label={assessmentLabel(filters.assessment)} onRemove={() => toggle('assessment', filters.assessment)} />}
                {filters.language   && <ActivePill label={filters.language === 'english' ? 'English' : 'Spanish'} onRemove={() => toggle('language', filters.language)} />}
                {filters.media      && <ActivePill label={filters.media === 'video' ? 'Video' : 'Audio'} onRemove={() => toggle('media', filters.media)} />}
                {filters.gender     && <ActivePill label={filters.gender} onRemove={() => toggle('gender', filters.gender)} />}
                {filters.grade      && <ActivePill label={filters.grade} onRemove={() => toggle('grade', filters.grade)} />}
                {count > 0 && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors ml-1">
                    Clear all
                  </button>
                )}
              </div>

              {/* Bottom sheet */}
              {sheetOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSheetOpen(false)} />
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[80dvh] flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-800">Filter responses</span>
                      <div className="flex items-center gap-3">
                        {count > 0 && (
                          <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>
                        )}
                        <button onClick={() => setSheetOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
                          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M5 5l10 10M15 5L5 15"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                      {bundleNames.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Bundle</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Chip label="All" active={!filters.bundle} available onClick={() => setFilters(f => ({ ...f, bundle: null, assessment: null }))} />
                            {bundleNames.map(b => <Chip key={b} label={b} active={filters.bundle === b} available={availBundles.has(b)} onClick={() => toggle('bundle', b)} />)}
                          </div>
                        </div>
                      )}
                      {assessments.length > 1 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Assessment</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Chip label="All" active={!filters.assessment} available onClick={() => toggle('assessment', null)} />
                            {assessments.map(a => <Chip key={a.id} label={a.title} active={filters.assessment === a.id} available={availAssessments.has(a.id)} onClick={() => toggle('assessment', a.id)} />)}
                          </div>
                        </div>
                      )}
                      {hasSpanish && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Language</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Chip label="All" active={!filters.language} available onClick={() => toggle('language', null)} />
                            <Chip label="English" active={filters.language === 'english'} available={availLanguages.has('english')} onClick={() => toggle('language', 'english')} activeClass="bg-blue-600 text-white" />
                            <Chip label="Spanish" active={filters.language === 'spanish'} available={availLanguages.has('spanish')} onClick={() => toggle('language', 'spanish')} activeClass="bg-orange-500 text-white" />
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Media</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Chip label="All" active={!filters.media} available onClick={() => toggle('media', null)} />
                          <Chip label="Video" active={filters.media === 'video'} available={availMedia.has('video')} onClick={() => toggle('media', 'video')} activeClass="bg-[#1a56db] text-white" />
                          <Chip label="Audio" active={filters.media === 'audio'} available={availMedia.has('audio')} onClick={() => toggle('media', 'audio')} activeClass="bg-violet-700 text-white" />
                        </div>
                      </div>
                      {genders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Gender</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Chip label="All" active={!filters.gender} available onClick={() => toggle('gender', null)} />
                            {genders.map(g => <Chip key={g} label={g} active={filters.gender === g} available={availGenders.has(g)} onClick={() => toggle('gender', g)} activeClass="bg-purple-600 text-white" />)}
                          </div>
                        </div>
                      )}
                      {grades.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Grade / Role</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Chip label="All" active={!filters.grade} available onClick={() => toggle('grade', null)} />
                            {grades.map(g => <Chip key={g} label={g} active={filters.grade === g} available={availGrades.has(g)} onClick={() => toggle('grade', g)} activeClass="bg-teal-600 text-white" />)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
                      <button onClick={() => setSheetOpen(false)} className="w-full py-2.5 rounded-xl bg-[#1a2744] text-white text-sm font-semibold">
                        Show {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Desktop filters ─────────────────────────────────── */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 p-5 mb-8">
              <div className="grid grid-cols-3 gap-6 divide-x divide-gray-100">
                {/* What */}
                <FilterGroup title="What">
                  {bundleNames.length > 0 && (
                    <FilterRow label="Bundle">
                      <Chip label="All" active={!filters.bundle} available onClick={() => setFilters(f => ({ ...f, bundle: null, assessment: null }))} />
                      {bundleNames.map(b => <Chip key={b} label={b} active={filters.bundle === b} available={availBundles.has(b)} onClick={() => toggle('bundle', b)} />)}
                    </FilterRow>
                  )}
                  {assessments.length > 1 && (
                    <FilterRow label={bundleNames.length > 0 ? '↳' : 'Assessment'}>
                      <Chip label="All" active={!filters.assessment} available onClick={() => toggle('assessment', null)} />
                      {assessments.map(a => <Chip key={a.id} label={a.title} active={filters.assessment === a.id} available={availAssessments.has(a.id)} onClick={() => toggle('assessment', a.id)} />)}
                    </FilterRow>
                  )}
                </FilterGroup>

                {/* Format */}
                <FilterGroup title="Format">
                  <div className="pl-4 space-y-2">
                    {hasSpanish && (
                      <FilterRow label="Language">
                        <Chip label="All" active={!filters.language} available onClick={() => toggle('language', null)} />
                        <Chip label="EN" active={filters.language === 'english'} available={availLanguages.has('english')} onClick={() => toggle('language', 'english')} activeClass="bg-blue-600 text-white" />
                        <Chip label="ES" active={filters.language === 'spanish'} available={availLanguages.has('spanish')} onClick={() => toggle('language', 'spanish')} activeClass="bg-orange-500 text-white" />
                      </FilterRow>
                    )}
                    <FilterRow label="Media">
                      <Chip label="All" active={!filters.media} available onClick={() => toggle('media', null)} />
                      <Chip label="Video" active={filters.media === 'video'} available={availMedia.has('video')} onClick={() => toggle('media', 'video')} activeClass="bg-[#1a56db] text-white" />
                      <Chip label="Audio" active={filters.media === 'audio'} available={availMedia.has('audio')} onClick={() => toggle('media', 'audio')} activeClass="bg-violet-700 text-white" />
                    </FilterRow>
                  </div>
                </FilterGroup>

                {/* Who */}
                <FilterGroup title="Who">
                  <div className="pl-4 space-y-2">
                    {genders.length > 0 && (
                      <FilterRow label="Gender">
                        <Chip label="All" active={!filters.gender} available onClick={() => toggle('gender', null)} />
                        {genders.map(g => <Chip key={g} label={g} active={filters.gender === g} available={availGenders.has(g)} onClick={() => toggle('gender', g)} activeClass="bg-purple-600 text-white" />)}
                      </FilterRow>
                    )}
                    {grades.length > 0 && (
                      <FilterRow label="Grade">
                        <Chip label="All" active={!filters.grade} available onClick={() => toggle('grade', null)} />
                        {grades.map(g => <Chip key={g} label={g} active={filters.grade === g} available={availGrades.has(g)} onClick={() => toggle('grade', g)} activeClass="bg-teal-600 text-white" />)}
                      </FilterRow>
                    )}
                  </div>
                </FilterGroup>
              </div>
              {count > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all filters</button>
                </div>
              )}
            </div>
          </>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400">No sample responses match your filters.</p>
        ) : (
          <div className="space-y-8">
            {filtered.map(({ question, sample, assessment, bundleTitle }) => {
              const mt = mediaTypeBadge(sample.mediaType);
              return (
                <div key={sample.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {bundleTitle && <span className="text-xs text-gray-400">{bundleTitle} ›</span>}
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: assessment.badgeBg, color: assessment.badgeText }}>{assessment.typeLabel}</span>
                      <span className="text-xs font-medium text-gray-700">{assessment.title}</span>
                      {sample.language === 'spanish' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">En Español</span>}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: mt.bg, color: mt.color }}>{mt.label}</span>
                      {sample.gender && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{sample.gender}</span>}
                      {sample.grade  && <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">{sample.grade}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{question.title}</h3>
                  </div>
                  {sample.excerpt && (
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-sm text-gray-600 italic leading-relaxed">&ldquo;{sample.excerpt}&rdquo;</p>
                    </div>
                  )}
                  <div className="aspect-video bg-gray-50">
                    <iframe
                      src={sample.embedUrl}
                      allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *; display-capture *;"
                      className="w-full h-full"
                      style={{ border: 'none' }}
                      title={`Sample response — ${question.title}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
