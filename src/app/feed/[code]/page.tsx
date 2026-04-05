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

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [codeData, setCodeData] = useState<AccessCode | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filterBundle, setFilterBundle] = useState<string | null>(null);
  const [filterAssessment, setFilterAssessment] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<'english' | 'spanish' | null>(null);
  const [filterMedia, setFilterMedia] = useState<'video' | 'audio' | null>(null);
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<string | null>(null);

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

  // Build all items
  const allItems: FeedItem[] = [];
  function collectQuestions(questions: Question[], assessment: Assessment, bundleTitle?: string) {
    for (const q of questions) {
      for (const sample of q.samples ?? []) {
        allItems.push({ question: q, sample, assessment, bundleTitle });
      }
    }
  }
  for (const assessment of codeData.assessments) {
    if (assessment.type === 'bundle') {
      for (const child of assessment.childAssessments ?? []) {
        collectQuestions(child.questions, child, assessment.title);
      }
    } else {
      collectQuestions(assessment.questions, assessment);
    }
  }

  // Derive unique values for each filter dimension
  const bundleNames  = [...new Set(allItems.map(i => i.bundleTitle).filter(Boolean))] as string[];
  const assessments  = [...new Map(allItems.filter(i => !i.bundleTitle).map(i => [i.assessment.id, i.assessment])).values()];
  const genders      = [...new Set(allItems.map(i => i.sample.gender).filter(Boolean))] as string[];
  const grades       = [...new Set(allItems.map(i => i.sample.grade).filter(Boolean))] as string[];
  const hasSpanish   = allItems.some(i => i.sample.language === 'spanish');
  const hasAudio     = allItems.some(i => i.sample.mediaType === 'audio');

  const filtered = allItems.filter(item => {
    if (filterBundle    && item.bundleTitle !== filterBundle) return false;
    if (filterAssessment && item.assessment.id !== filterAssessment) return false;
    if (filterLanguage  && item.sample.language !== filterLanguage) return false;
    if (filterMedia     && (item.sample.mediaType ?? 'video') !== filterMedia) return false;
    if (filterGender    && item.sample.gender !== filterGender) return false;
    if (filterGrade     && item.sample.grade !== filterGrade) return false;
    return true;
  });

  function Chip({ label, active, onClick, activeClass }: { label: string; active: boolean; onClick: () => void; activeClass?: string }) {
    return (
      <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
          active
            ? (activeClass ?? 'bg-[#1a2744] text-white')
            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        {label}
      </button>
    );
  }

  function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-start gap-3">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-2 w-16 flex-shrink-0">{label}</span>
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    );
  }

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
          <p className="text-gray-500 text-sm">Browse example responses for the assessments in your plan.</p>
        </div>

        {/* Filters */}
        {allItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-8 space-y-3">
            {bundleNames.length > 0 && (
              <FilterRow label="Bundle">
                <Chip label="All" active={!filterBundle} onClick={() => { setFilterBundle(null); setFilterAssessment(null); }} />
                {bundleNames.map(b => (
                  <Chip key={b} label={b} active={filterBundle === b} onClick={() => { setFilterBundle(filterBundle === b ? null : b); setFilterAssessment(null); }} />
                ))}
              </FilterRow>
            )}
            {assessments.length > 0 && (
              <FilterRow label="Assessment">
                <Chip label="All" active={!filterAssessment} onClick={() => setFilterAssessment(null)} />
                {assessments.map(a => (
                  <Chip key={a.id} label={a.title} active={filterAssessment === a.id} onClick={() => setFilterAssessment(filterAssessment === a.id ? null : a.id)} />
                ))}
              </FilterRow>
            )}
            {hasSpanish && (
              <FilterRow label="Language">
                <Chip label="All" active={!filterLanguage} onClick={() => setFilterLanguage(null)} />
                <Chip label="English" active={filterLanguage === 'english'} onClick={() => setFilterLanguage(filterLanguage === 'english' ? null : 'english')} activeClass="bg-blue-600 text-white" />
                <Chip label="Spanish" active={filterLanguage === 'spanish'} onClick={() => setFilterLanguage(filterLanguage === 'spanish' ? null : 'spanish')} activeClass="bg-orange-500 text-white" />
              </FilterRow>
            )}
            {hasAudio && (
              <FilterRow label="Media">
                <Chip label="All" active={!filterMedia} onClick={() => setFilterMedia(null)} />
                <Chip label="Video" active={filterMedia === 'video'} onClick={() => setFilterMedia(filterMedia === 'video' ? null : 'video')} activeClass="bg-[#1a56db] text-white" />
                <Chip label="Audio" active={filterMedia === 'audio'} onClick={() => setFilterMedia(filterMedia === 'audio' ? null : 'audio')} activeClass="bg-violet-700 text-white" />
              </FilterRow>
            )}
            {genders.length > 0 && (
              <FilterRow label="Gender">
                <Chip label="All" active={!filterGender} onClick={() => setFilterGender(null)} />
                {genders.map(g => (
                  <Chip key={g} label={g} active={filterGender === g} onClick={() => setFilterGender(filterGender === g ? null : g)} activeClass="bg-purple-600 text-white" />
                ))}
              </FilterRow>
            )}
            {grades.length > 0 && (
              <FilterRow label="Grade">
                <Chip label="All" active={!filterGrade} onClick={() => setFilterGrade(null)} />
                {grades.map(g => (
                  <Chip key={g} label={g} active={filterGrade === g} onClick={() => setFilterGrade(filterGrade === g ? null : g)} activeClass="bg-teal-600 text-white" />
                ))}
              </FilterRow>
            )}
          </div>
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
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: assessment.badgeBg, color: assessment.badgeText }}>
                        {assessment.typeLabel}
                      </span>
                      <span className="text-xs font-medium text-gray-700">{assessment.title}</span>
                      {sample.language === 'spanish' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">En Español</span>
                      )}
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
