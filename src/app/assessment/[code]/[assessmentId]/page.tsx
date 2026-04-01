'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import codesData from '@/data/codes.json';
import { getProgress, markQuestionComplete } from '@/lib/progress';
import type { AccessCode, Assessment, Question } from '@/types/assessment';

/* ─── Confetti piece (pure CSS animation) ─────────────────── */
const CONFETTI_COLORS = ['#e8735a', '#4a6fa5', '#1D9E75', '#7B68C4', '#f59e0b', '#ec4899'];

function ConfettiPiece({ index: i }: { index: number }) {
  const left = 3 + i * 4.7;
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  const delay = i * 0.09;
  const duration = 1.4 + (i % 5) * 0.28;
  const isCircle = i % 3 !== 0;

  return (
    <div
      className="absolute animate-confetti-fall pointer-events-none"
      style={{
        left: `${left}%`,
        top: 0,
        width: 10,
        height: 10,
        borderRadius: isCircle ? '50%' : '2px',
        background: color,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    />
  );
}

/* ─── Sidebar question item ────────────────────────────────── */
function QuestionItem({
  q,
  isActive,
  isComplete,
  onClick,
}: {
  q: Question;
  isActive: boolean;
  isComplete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center gap-3 transition-all',
        isActive
          ? 'bg-blue-50 border-l-[3px] border-blue-500'
          : 'hover:bg-gray-100 border-l-[3px] border-transparent',
      ].join(' ')}
    >
      {/* State indicator */}
      {isComplete ? (
        <span
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{ background: '#1D9E75' }}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <path
              d="M1 5L4.5 8.5L11 1.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : isActive ? (
        <span
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ background: '#4a6fa5' }}
        >
          {q.order}
        </span>
      ) : (
        <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-medium border-2 border-gray-300">
          {q.order}
        </span>
      )}

      <span
        className={[
          'text-sm leading-tight',
          isComplete
            ? 'text-gray-400'
            : isActive
            ? 'text-gray-900 font-semibold'
            : 'text-gray-400',
        ].join(' ')}
      >
        {q.title}
      </span>
    </button>
  );
}

/* ─── Main page ────────────────────────────────────────────── */
export default function AssessmentPlayerPage() {
  const params   = useParams();
  const router   = useRouter();
  const code         = (params.code as string).toUpperCase();
  const assessmentId = params.assessmentId as string;

  const codeData   = codesData.codes.find((c) => c.code === code) as AccessCode | undefined;
  const assessment = codeData?.assessments.find((a) => a.id === assessmentId) as Assessment | undefined;

  const [currentIdx, setCurrentIdx]           = useState(0);
  const [mode, setMode]                       = useState<'video' | 'spanish' | 'text'>('video');
  // Lazy-init from localStorage (returns {} during SSR, real data on client)
  const [completion, setCompletion]           = useState<Record<string, boolean>>(
    () => (typeof window !== 'undefined' ? (getProgress(code)[assessmentId] ?? {}) : {}),
  );
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationShownRef                   = useRef(false);

  // Redirect-only effect – no setState called here
  useEffect(() => {
    if (!codeData || !assessment) router.replace('/assessment');
  }, [codeData, assessment, router]);

  if (!codeData || !assessment) return null;

  const questions     = [...assessment.questions].sort((a, b) => a.order - b.order);
  const currentQ      = questions[currentIdx];
  const completedCount = questions.filter((q) => !!completion[q.id]).length;

  const handleMarkComplete = () => {
    if (completion[currentQ.id]) return;
    markQuestionComplete(code, assessmentId, currentQ.id);
    const next = { ...completion, [currentQ.id]: true };
    setCompletion(next);

    // Show celebration once all are done
    const nowAllDone = questions.every((q) => !!next[q.id]);
    if (nowAllDone && !celebrationShownRef.current) {
      celebrationShownRef.current = true;
      setTimeout(() => setShowCelebration(true), 400);
    }
  };

  const goPrev = () => { setCurrentIdx((i) => Math.max(0, i - 1)); setMode('video'); };
  const goNext = () => { setCurrentIdx((i) => Math.min(questions.length - 1, i + 1)); setMode('video'); };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-white">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background: '#1a2744' }}
      >
        <button
          onClick={() => router.push(`/assessment/${code}`)}
          className="text-white/60 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
        >
          ← Back to assessments
        </button>

        <div className="hidden md:flex items-center gap-2.5">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: assessment.badgeBg, color: assessment.badgeText }}
          >
            {assessment.typeLabel}
          </span>
          <span className="text-white font-semibold text-sm hidden sm:block">
            {assessment.title}
          </span>
        </div>

        <span className="text-white/50 text-sm whitespace-nowrap">
          {completedCount} of {questions.length} complete
        </span>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside className="hidden md:flex w-60 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex-col">
          <div className="px-4 pt-5 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Questions
            </p>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((completedCount / questions.length) * 100)}%`,
                  background: '#1D9E75',
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mb-3 text-right">
              {completedCount}/{questions.length}
            </p>
          </div>

          <div className="overflow-y-auto flex-1 px-2 pb-4">
            {questions.map((q, idx) => (
              <QuestionItem
                key={q.id}
                q={q}
                isActive={idx === currentIdx}
                isComplete={!!completion[q.id]}
                onClick={() => { setCurrentIdx(idx); setMode('video'); }}
              />
            ))}
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden">

          {/* Mode toggle strip — both buttons always visible when available */}
          {(currentQ.spanishEmbedUrl || currentQ.textEmbedUrl) && (
            <div className="flex-shrink-0 flex items-center justify-end flex-wrap gap-2 px-4 md:px-6 pt-3 pb-1 bg-gray-50">
              {currentQ.spanishEmbedUrl && (
                <button
                  onClick={() => setMode(mode === 'spanish' ? 'video' : 'spanish')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
                  style={mode === 'spanish'
                    ? { background: '#e8735a', color: 'white', outline: '2px solid #c75a3a' }
                    : { background: '#e8735a', color: 'white' }}
                >
                  <span>🌐</span>
                  Try in Spanish
                </button>
              )}
              {currentQ.textEmbedUrl && (
                <button
                  onClick={() => setMode(mode === 'text' ? 'video' : 'text')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
                  style={mode === 'text'
                    ? { background: '#4a6fa5', color: 'white', outline: '2px solid #2d4a7a' }
                    : { background: '#4a6fa5', color: 'white' }}
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                    <rect x="1" y="3" width="13" height="9" rx="1.5" stroke="white" strokeWidth="1.4"/>
                    <path d="M4 7h7M4 9.5h4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  I prefer to type
                </button>
              )}
            </div>
          )}

          {/* Mobile-only question title (sidebar hidden on mobile) */}
          <div className="md:hidden flex-shrink-0 px-4 pt-3 pb-1 bg-gray-50">
            <span
              className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1.5"
              style={{ background: assessment.badgeBg, color: assessment.badgeText }}
            >
              {assessment.typeLabel}
            </span>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Question {currentQ.order} of {questions.length}
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{currentQ.title}</p>
          </div>

          {/* iframe — portrait aspect-ratio on mobile, fills height on desktop */}
          <div className="md:flex-1 md:overflow-hidden md:flex md:items-stretch md:justify-center px-4 md:px-16 py-4 md:py-5 bg-gray-50">
            <iframe
              key={`${currentQ.id}-${mode}`}
              src={
                mode === 'spanish' && currentQ.spanishEmbedUrl ? currentQ.spanishEmbedUrl :
                mode === 'text'    && currentQ.textEmbedUrl    ? currentQ.textEmbedUrl :
                currentQ.embedUrl
              }
              allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *; display-capture *;"
              className="w-full aspect-[3/4] md:aspect-auto md:h-full md:max-w-[720px]"
              style={{ border: 'none', borderRadius: 16, display: 'block' }}
              title={currentQ.title}
            />
          </div>

          {/* ── Bottom navigation + Mark Complete ───────────── */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between bg-white gap-4">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-0 transition-all"
            >
              ← Previous
            </button>

            {/* Center: dot indicators + Mark Complete */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentIdx(idx); setMode('video'); }}
                    title={q.title}
                    className="rounded-full transition-all duration-200 hover:opacity-80"
                    style={{
                      width:  idx === currentIdx ? 10 : 8,
                      height: idx === currentIdx ? 10 : 8,
                      background: completion[q.id]
                        ? '#1D9E75'
                        : idx === currentIdx
                        ? '#4a6fa5'
                        : '#d1d5db',
                    }}
                  />
                ))}
              </div>

              {completion[currentQ.id] ? (
                <div
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ color: '#1D9E75', background: '#E1F5EE' }}
                >
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                    <path d="M1 5L4.5 8.5L11 1.5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Completed
                </div>
              ) : (
                <button
                  onClick={handleMarkComplete}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all"
                >
                  Mark as Complete
                </button>
              )}
            </div>

            <button
              onClick={goNext}
              disabled={currentIdx === questions.length - 1}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-0 transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── Celebration overlay ─────────────────────────────── */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 21 }).map((_, i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl p-12 max-w-sm w-full text-center shadow-2xl mx-4 relative z-10 animate-slide-up">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: '#E1F5EE' }}
            >
              <svg width="38" height="32" viewBox="0 0 38 32" fill="none" aria-hidden="true">
                <path
                  d="M2 16L13.5 27.5L36 3"
                  stroke="#1D9E75"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Assessment Complete!
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              You&apos;ve completed all{' '}
              <strong>{questions.length}</strong> questions in{' '}
              <strong>{assessment.title}</strong>.
            </p>

            <button
              onClick={() => {
                setShowCelebration(false);
                router.push(`/assessment/${code}`);
              }}
              className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
              style={{ background: '#1D9E75' }}
            >
              Return to Assessments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
