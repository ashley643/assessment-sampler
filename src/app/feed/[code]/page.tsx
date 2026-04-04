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
  const [filterAssessment, setFilterAssessment] = useState<string | null>(null);
  const [filterBundle, setFilterBundle] = useState<string | null>(null);
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

  // One feed item per sample
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

  // Derive unique filter values
  const bundles = [...new Map(
    allItems.filter(i => i.bundleTitle).map(i => [i.bundleTitle, i.bundleTitle])
  ).values()] as string[];

  const assessments = [...new Map(allItems.map(i => [i.assessment.id, i.assessment])).values()];

  const genders = [...new Set(allItems.map(i => i.sample.gender).filter(Boolean))] as string[];
  const grades  = [...new Set(allItems.map(i => i.sample.grade).filter(Boolean))] as string[];

  // Apply filters
  const filtered = allItems.filter(item => {
    if (filterBundle && item.bundleTitle !== filterBundle) return false;
    if (filterAssessment && item.assessment.id !== filterAssessment) return false;
    if (filterGender && item.sample.gender !== filterGender) return false;
    if (filterGrade && item.sample.grade !== filterGrade) return false;
    return true;
  });

  function chip(label: string, active: boolean, onClick: () => void, color?: string) {
    return (
      <button
        key={label}
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
          active
            ? (color ?? 'bg-[#1a2744] text-white')
            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        {label}
      </button>
    );
  }

  const hasFilters = genders.length > 0 || grades.length > 0 || bundles.length > 0 || assessments.length > 1;

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

        {hasFilters && (
          <div className="space-y-3 mb-8">
            {/* Assessment filters */}
            {(bundles.length > 0 || assessments.length > 1) && (
              <div className="flex flex-wrap gap-2">
                {chip('All assessments', !filterBundle && !filterAssessment, () => { setFilterBundle(null); setFilterAssessment(null); })}
                {bundles.map(b => chip(b, filterBundle === b, () => { setFilterBundle(filterBundle === b ? null : b); setFilterAssessment(null); }))}
                {assessments
                  .filter(a => !filterBundle || allItems.some(i => i.assessment.id === a.id && i.bundleTitle === filterBundle))
                  .map(a => chip(a.title, filterAssessment === a.id, () => { setFilterAssessment(filterAssessment === a.id ? null : a.id); setFilterBundle(null); }))}
              </div>
            )}

            {/* Gender filters */}
            {genders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chip('All genders', !filterGender, () => setFilterGender(null))}
                {genders.map(g => chip(g, filterGender === g, () => setFilterGender(filterGender === g ? null : g), 'bg-purple-600 text-white'))}
              </div>
            )}

            {/* Grade filters */}
            {grades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chip('All grades', !filterGrade, () => setFilterGrade(null))}
                {grades.map(g => chip(g, filterGrade === g, () => setFilterGrade(filterGrade === g ? null : g), 'bg-teal-600 text-white'))}
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400">No sample responses match your filters.</p>
        ) : (
          <div className="space-y-8">
            {filtered.map(({ question, sample, assessment, bundleTitle }) => (
              <div key={sample.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Card header */}
                <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {bundleTitle && <span className="text-xs text-gray-400">{bundleTitle} ›</span>}
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: assessment.badgeBg, color: assessment.badgeText }}>
                      {assessment.typeLabel}
                    </span>
                    <span className="text-xs font-medium text-gray-700">{assessment.title}</span>
                    {sample.language === 'spanish' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fde8e3', color: '#c0432a' }}>
                        En Español
                      </span>
                    )}
                    {sample.gender && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                        {sample.gender}
                      </span>
                    )}
                    {sample.grade && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                        {sample.grade}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{question.title}</h3>
                </div>

                {/* Embedded sample */}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
