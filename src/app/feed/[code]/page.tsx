'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import type { AccessCode, Assessment, Question } from '@/types/assessment';

interface FeedItem {
  question: Question;
  assessment: Assessment;
  bundleTitle?: string;
}

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [codeData, setCodeData] = useState<AccessCode | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filterAssessment, setFilterAssessment] = useState<string | null>(null);
  const [filterBundle, setFilterBundle] = useState<string | null>(null);
  const [spanishStates, setSpanishStates] = useState<Record<string, boolean>>({});

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

  // Collect all feed items: questions with at least an English sample
  const allItems: FeedItem[] = [];
  for (const assessment of codeData.assessments) {
    if (assessment.type === 'bundle') {
      for (const child of assessment.childAssessments ?? []) {
        for (const q of child.questions) {
          if (q.sampleEmbedUrl) {
            allItems.push({ question: q, assessment: child, bundleTitle: assessment.title });
          }
        }
      }
    } else {
      for (const q of assessment.questions) {
        if (q.sampleEmbedUrl) {
          allItems.push({ question: q, assessment });
        }
      }
    }
  }

  // Derive unique bundles and assessments for filter chips
  const bundles = [...new Map(
    allItems.filter(i => i.bundleTitle).map(i => [i.bundleTitle, i.bundleTitle])
  ).values()] as string[];

  const assessments = [...new Map(
    allItems.map(i => [i.assessment.id, i.assessment])
  ).values()];

  // Apply filters
  const filtered = allItems.filter(item => {
    if (filterBundle && item.bundleTitle !== filterBundle) return false;
    if (filterAssessment && item.assessment.id !== filterAssessment) return false;
    return true;
  });

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
        active
          ? 'bg-[#1a2744] text-white'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      {/* Nav */}
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

        {/* Filter chips */}
        {(bundles.length > 0 || assessments.length > 1) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {chip('All', !filterBundle && !filterAssessment, () => { setFilterBundle(null); setFilterAssessment(null); })}
            {bundles.map(b => chip(b, filterBundle === b, () => { setFilterBundle(filterBundle === b ? null : b); setFilterAssessment(null); }))}
            {assessments
              .filter(a => !filterBundle || allItems.some(i => i.assessment.id === a.id && i.bundleTitle === filterBundle))
              .map(a => chip(a.title, filterAssessment === a.id, () => { setFilterAssessment(filterAssessment === a.id ? null : a.id); setFilterBundle(null); }))}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400">No sample responses available yet.</p>
        ) : (
          <div className="space-y-8">
            {filtered.map(({ question, assessment, bundleTitle }) => {
              const isSpanish = !!spanishStates[question.id];
              const src = isSpanish && question.sampleSpanishEmbedUrl
                ? question.sampleSpanishEmbedUrl
                : question.sampleEmbedUrl!;

              return (
                <div key={question.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Card header */}
                  <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {bundleTitle && (
                        <span className="text-xs text-gray-400">{bundleTitle}</span>
                      )}
                      {bundleTitle && <span className="text-gray-200 text-xs">›</span>}
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: assessment.badgeBg, color: assessment.badgeText }}
                      >
                        {assessment.typeLabel}
                      </span>
                      <span className="text-xs font-medium text-gray-700">{assessment.title}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold text-gray-900">{question.title}</h3>
                      {question.sampleSpanishEmbedUrl && (
                        <button
                          onClick={() => setSpanishStates(s => ({ ...s, [question.id]: !s[question.id] }))}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                          style={isSpanish ? { background: '#e8735a', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}
                        >
                          <span>🌐</span>
                          {isSpanish ? 'En Español' : 'Try in Spanish'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Embedded sample */}
                  <div className="aspect-video bg-gray-50">
                    <iframe
                      key={`${question.id}-${isSpanish}`}
                      src={src}
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
