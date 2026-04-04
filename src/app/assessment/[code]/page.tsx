'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { getProgress } from '@/lib/progress';
import { track } from '@/lib/track';
import type { AccessCode, Assessment } from '@/types/assessment';

export default function AssessmentSelectorPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
  const [codeData, setCodeData] = useState<AccessCode | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Lazy-init from localStorage (returns {} during SSR, real data on client)
  const [completion] = useState<Record<string, Record<string, boolean>>>(
    () => (typeof window !== 'undefined' ? getProgress(code) : {}),
  );

  useEffect(() => {
    fetch(`/api/codes/${code}`)
      .then(async res => {
        if (!res.ok) { setNotFound(true); return; }
        const data: AccessCode = await res.json();
        setCodeData(data);
        if (!isPreview) track('session_start', code);
      })
      .catch(() => setNotFound(true));
  }, [code]);

  useEffect(() => {
    if (notFound) router.replace('/assessment');
  }, [notFound, router]);

  if (!codeData) return null;

  const isComplete = (a: Assessment) =>
    a.questions.length > 0 &&
    a.questions.every((q) => !!(completion[a.id] ?? {})[q.id]);

  const completedCount = (a: Assessment) =>
    a.questions.filter((q) => !!(completion[a.id] ?? {})[q.id]).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      {isPreview && (
        <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5 tracking-wide">
          PREVIEW MODE — activity is not being tracked
        </div>
      )}
      {/* ── Nav bar ───────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: '#1a2744' }}
      >
        <Image
          src="/Logo_Transparent_Background.png"
          alt="Impacter Pathway"
          width={130}
          height={39}
          className="object-contain"
        />

        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm">{codeData.label}</span>
          <span className="bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full font-mono">
            {code}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/feed/${code}`)}
            className="text-white/70 hover:text-white text-sm transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 5l3.5 2L5 9V5z" fill="currentColor"/>
            </svg>
            Sample Responses
          </button>
          <button
            onClick={() => router.push('/assessment')}
            className="text-white/50 hover:text-white text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-12 animate-slide-up">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {codeData.label}
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed max-w-2xl">
            Select an assessment below to explore sample questions and experience
            how Impacter Pathway captures student voice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(codeData.assessments as Assessment[]).map((assessment) => {
            const done = isComplete(assessment);
            const nDone = completedCount(assessment);
            const estMins = assessment.questions.length * 3;
            const pct = assessment.questions.length
              ? Math.round((nDone / assessment.questions.length) * 100)
              : 0;

            const isBundle = assessment.type === 'bundle';
            const childCount = assessment.childAssessments?.length ?? 0;

            return (
              <div
                key={assessment.id}
                onClick={() =>
                  router.push(`/assessment/${code}/${assessment.id}${isPreview ? '?preview=true' : ''}`)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    router.push(`/assessment/${code}/${assessment.id}${isPreview ? '?preview=true' : ''}`);
                }}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{
                  borderTopWidth: '4px',
                  borderTopColor: assessment.accentColor,
                }}
              >
                <div className="p-6">
                  {/* Badges row */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{
                        background: assessment.badgeBg,
                        color: assessment.badgeText,
                      }}
                    >
                      {assessment.typeLabel}
                    </span>

                    {done && !isBundle && (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                        <svg width="10" height="9" viewBox="0 0 10 9" fill="none" aria-hidden="true">
                          <path d="M1 4.5L3.5 7L9 1.5" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Complete
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3
                    className="font-bold text-gray-900 mb-2 text-base leading-snug"
                    style={done && !isBundle ? { color: '#15803d' } : undefined}
                  >
                    {assessment.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                    {assessment.description}
                  </p>

                  {isBundle ? (
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        {childCount} version{childCount !== 1 ? 's' : ''} available
                      </div>
                      <div className="text-xs font-medium flex items-center gap-1" style={{ color: assessment.accentColor }}>
                        Select a version
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-400">
                        {assessment.questions.length} questions · ~{estMins} min
                      </div>
                      {nDone > 0 && !done && (
                        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: assessment.accentColor }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
