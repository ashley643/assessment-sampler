'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProgress, markQuestionComplete } from '@/lib/progress';
import { track } from '@/lib/track';
import type { AccessCode, Assessment, Question } from '@/types/assessment';

/* ─── Confetti piece ───────────────────────────────────────── */
const CONFETTI_COLORS = ['#e8735a', '#4a6fa5', '#1D9E75', '#7B68C4', '#f59e0b', '#ec4899'];

function ConfettiPiece({ index: i }: { index: number }) {
  return (
    <div
      className="absolute animate-confetti-fall pointer-events-none"
      style={{
        left: `${3 + i * 4.7}%`,
        top: 0,
        width: 10,
        height: 10,
        borderRadius: i % 3 !== 0 ? '50%' : '2px',
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        animationDelay: `${i * 0.09}s`,
        animationDuration: `${1.4 + (i % 5) * 0.28}s`,
      }}
    />
  );
}

/* ─── Tooltip wrapper ──────────────────────────────────────── */
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg z-20 text-center leading-relaxed shadow-lg">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar question item ────────────────────────────────── */
function QuestionItem({ q, isActive, isComplete, onClick }: {
  q: Question; isActive: boolean; isComplete: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center gap-3 transition-all',
        isActive ? 'bg-blue-50 border-l-[3px] border-blue-500' : 'hover:bg-gray-100 border-l-[3px] border-transparent',
      ].join(' ')}
    >
      {isComplete ? (
        <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#1D9E75' }}>
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : isActive ? (
        <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#4a6fa5' }}>
          {q.order}
        </span>
      ) : (
        <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-gray-400 text-xs font-medium border-2 border-gray-300">
          {q.order}
        </span>
      )}
      <span className={['text-sm leading-tight', isComplete ? 'text-gray-400' : isActive ? 'text-gray-900 font-semibold' : 'text-gray-400'].join(' ')}>
        {q.title}
      </span>
    </button>
  );
}

/* ─── Main page ────────────────────────────────────────────── */
export default function AssessmentPlayerPage() {
  const params       = useParams();
  const router       = useRouter();
  const code         = (params.code as string).toUpperCase();
  const assessmentId = params.assessmentId as string;

  const [codeData, setCodeData]   = useState<AccessCode | null>(null);
  const [notFound, setNotFound]   = useState(false);
  const [currentIdx, setCurrentIdx]           = useState(0);
  const [spanishMode, setSpanishMode]         = useState(false);
  const [showTyping, setShowTyping]           = useState(false);
  const [typedAnswer, setTypedAnswer]         = useState('');
  const [typedSubmitted, setTypedSubmitted]   = useState(false);
  const [completion, setCompletion]           = useState<Record<string, boolean>>(
    () => (typeof window !== 'undefined' ? (getProgress(code)[assessmentId] ?? {}) : {}),
  );
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationShownRef = useRef(false);

  useEffect(() => {
    fetch(`/api/codes/${code}`)
      .then(async res => {
        if (!res.ok) { setNotFound(true); return; }
        const data: AccessCode = await res.json();
        setCodeData(data);
        track('assessment_open', code, { assessment_id: assessmentId });
      })
      .catch(() => setNotFound(true));
  }, [code, assessmentId]);

  useEffect(() => { if (notFound) router.replace('/assessment'); }, [notFound, router]);

  if (!codeData) return null;

  const assessment = codeData.assessments.find(a => a.id === assessmentId) as Assessment | undefined;
  if (!assessment) { router.replace(`/assessment/${code}`); return null; }

  const questions      = [...assessment.questions].sort((a, b) => a.order - b.order);
  const currentQ       = questions[currentIdx];
  const completedCount = questions.filter(q => !!completion[q.id]).length;

  const goToQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setSpanishMode(false);
    setShowTyping(false);
    setTypedAnswer('');
    setTypedSubmitted(false);
    track('question_view', code, { assessment_id: assessmentId, question_id: questions[idx].id });
  };

  const goPrev = () => goToQuestion(Math.max(0, currentIdx - 1));
  const goNext = () => goToQuestion(Math.min(questions.length - 1, currentIdx + 1));

  const finishQuestion = (qId: string, next: Record<string, boolean>) => {
    const nowAllDone = questions.every(q => !!next[q.id]);
    if (nowAllDone && !celebrationShownRef.current) {
      celebrationShownRef.current = true;
      track('assessment_complete', code, { assessment_id: assessmentId });
      setTimeout(() => setShowCelebration(true), 400);
    }
    void qId;
  };

  const handleMarkComplete = () => {
    if (completion[currentQ.id]) return;
    markQuestionComplete(code, assessmentId, currentQ.id);
    const next = { ...completion, [currentQ.id]: true };
    setCompletion(next);
    track('question_complete', code, { assessment_id: assessmentId, question_id: currentQ.id });
    finishQuestion(currentQ.id, next);
  };

  const handleTypedSubmit = () => {
    if (!typedAnswer.trim()) return;
    track('text_response', code, {
      assessment_id: assessmentId,
      question_id: currentQ.id,
      metadata: { text: typedAnswer.trim() },
    });
    setTypedSubmitted(true);
    if (!completion[currentQ.id]) {
      markQuestionComplete(code, assessmentId, currentQ.id);
      const next = { ...completion, [currentQ.id]: true };
      setCompletion(next);
      track('question_complete', code, { assessment_id: assessmentId, question_id: currentQ.id });
      finishQuestion(currentQ.id, next);
    }
  };

  const embedSrc = spanishMode && currentQ.spanishEmbedUrl ? currentQ.spanishEmbedUrl : currentQ.embedUrl;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-white">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ background: '#1a2744' }}>
        <button onClick={() => router.push(`/assessment/${code}`)} className="text-white/60 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
          ← Back to assessments
        </button>
        <div className="hidden md:flex items-center gap-2.5">
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: assessment.badgeBg, color: assessment.badgeText }}>
            {assessment.typeLabel}
          </span>
          <span className="text-white font-semibold text-sm hidden sm:block">{assessment.title}</span>
        </div>
        <span className="text-white/50 text-sm whitespace-nowrap">{completedCount} of {questions.length} complete</span>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside className="hidden md:flex w-60 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex-col">
          <div className="px-4 pt-5 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Questions</p>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((completedCount / questions.length) * 100)}%`, background: '#1D9E75' }} />
            </div>
            <p className="text-xs text-gray-400 mb-3 text-right">{completedCount}/{questions.length}</p>
          </div>
          <div className="overflow-y-auto flex-1 px-2 pb-4">
            {questions.map((q, idx) => (
              <QuestionItem key={q.id} q={q} isActive={idx === currentIdx} isComplete={!!completion[q.id]} onClick={() => goToQuestion(idx)} />
            ))}
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden">

          {/* Mode toggle strip */}
          <div className="flex-shrink-0 flex items-center justify-end flex-wrap gap-2 px-4 md:px-6 pt-3 pb-1 bg-gray-50">
            {currentQ.spanishEmbedUrl && (
              <Tooltip text="Assessments can be configured for additional prompt languages depending on the population being served.">
                <button
                  onClick={() => { setSpanishMode(m => !m); setShowTyping(false); setTypedAnswer(''); setTypedSubmitted(false); track('mode_change', code, { assessment_id: assessmentId, question_id: currentQ.id, metadata: { mode: spanishMode ? 'video' : 'spanish' } }); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
                  style={spanishMode ? { background: '#e8735a', color: 'white', outline: '2px solid #c75a3a' } : { background: '#e8735a', color: 'white' }}
                >
                  <span>🌐</span> Try in Spanish
                </button>
              </Tooltip>
            )}
            <Tooltip text="Customers may choose to enable typed responses as an alternative submission format to audio or video recording.">
              <button
                onClick={() => { setShowTyping(t => !t); setSpanishMode(false); setTypedAnswer(''); setTypedSubmitted(false); track('mode_change', code, { assessment_id: assessmentId, question_id: currentQ.id, metadata: { mode: showTyping ? 'video' : 'text' } }); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
                style={showTyping ? { background: '#4a6fa5', color: 'white', outline: '2px solid #2d4a7a' } : { background: '#4a6fa5', color: 'white' }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <rect x="1" y="3" width="13" height="9" rx="1.5" stroke="white" strokeWidth="1.4"/>
                  <path d="M4 7h7M4 9.5h4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                I prefer to type
              </button>
            </Tooltip>
          </div>

          {/* Mobile question header */}
          <div className="md:hidden flex-shrink-0 px-4 pt-3 pb-1 bg-gray-50">
            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1.5" style={{ background: assessment.badgeBg, color: assessment.badgeText }}>
              {assessment.typeLabel}
            </span>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Question {currentQ.order} of {questions.length}</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{currentQ.title}</p>
          </div>

          {/* iframe */}
          <div className={`md:overflow-hidden md:flex md:items-stretch md:justify-center px-4 md:px-16 py-4 md:py-5 bg-gray-50 transition-all ${showTyping ? 'md:h-52 flex-shrink-0' : 'md:flex-1'}`}>
            <iframe
              key={`${currentQ.id}-${spanishMode}`}
              src={embedSrc}
              allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *; display-capture *;"
              className={`w-full ${showTyping ? 'h-44 md:h-full md:max-w-[720px]' : 'aspect-[3/4] md:aspect-auto md:h-full md:max-w-[720px]'}`}
              style={{ border: 'none', borderRadius: 16, display: 'block' }}
              title={currentQ.title}
            />
          </div>

          {/* Text input panel */}
          {showTyping && (
            <div className="flex-1 md:overflow-hidden flex flex-col px-4 md:px-16 pb-2 bg-gray-50">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{currentQ.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Type your response below</p>
                </div>
                <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
                  {typedSubmitted ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#E1F5EE' }}>
                        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
                          <path d="M1 9L7.5 15.5L21 2" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">Response submitted</p>
                      <p className="text-xs text-gray-400">Your typed response has been recorded.</p>
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={typedAnswer}
                        onChange={e => setTypedAnswer(e.target.value)}
                        placeholder="Type your response here…"
                        className="flex-1 w-full resize-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[80px]"
                      />
                      <button
                        onClick={handleTypedSubmit}
                        disabled={!typedAnswer.trim()}
                        className="flex-shrink-0 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: '#4a6fa5' }}
                      >
                        Submit Response
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom nav */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between bg-white gap-4">
            <button onClick={goPrev} disabled={currentIdx === 0} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-0 transition-all">← Previous</button>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {questions.map((q, idx) => (
                  <button key={q.id} onClick={() => goToQuestion(idx)} title={q.title} className="rounded-full transition-all duration-200 hover:opacity-80"
                    style={{ width: idx === currentIdx ? 10 : 8, height: idx === currentIdx ? 10 : 8, background: completion[q.id] ? '#1D9E75' : idx === currentIdx ? '#4a6fa5' : '#d1d5db' }}
                  />
                ))}
              </div>
              {completion[currentQ.id] ? (
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold" style={{ color: '#1D9E75', background: '#E1F5EE' }}>
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true"><path d="M1 5L4.5 8.5L11 1.5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Completed
                </div>
              ) : (
                <button onClick={handleMarkComplete} className="px-4 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all">
                  Mark as Complete
                </button>
              )}
            </div>

            <button onClick={goNext} disabled={currentIdx === questions.length - 1} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-0 transition-all">Next →</button>
          </div>
        </div>
      </div>

      {/* ── Celebration overlay ──────────────────────────────── */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 21 }).map((_, i) => <ConfettiPiece key={i} index={i} />)}
          </div>
          <div className="bg-white rounded-2xl p-12 max-w-sm w-full text-center shadow-2xl mx-4 relative z-10 animate-slide-up">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#E1F5EE' }}>
              <svg width="38" height="32" viewBox="0 0 38 32" fill="none" aria-hidden="true">
                <path d="M2 16L13.5 27.5L36 3" stroke="#1D9E75" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Assessment Complete!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              You&apos;ve completed all <strong>{questions.length}</strong> questions in <strong>{assessment.title}</strong>.
            </p>
            <button onClick={() => { setShowCelebration(false); router.push(`/assessment/${code}`); }}
              className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-[0.99]" style={{ background: '#1D9E75' }}>
              Return to Assessments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
