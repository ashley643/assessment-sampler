'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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

/* ─── Tooltip wrapper (desktop hover only) ─────────────────── */
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
        <div className="hidden md:block pointer-events-none absolute top-full right-0 mt-2 w-60 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-xs rounded-xl z-20 text-center leading-relaxed shadow-lg">
          <div className="absolute bottom-full right-4 border-4 border-transparent border-b-gray-200" />
          <div className="absolute bottom-full right-4 translate-y-[1px] border-4 border-transparent border-b-white" />
          {text}
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
  const [selectedBenchmark, setSelectedBenchmark] = useState<Assessment | null>(null);
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
  const [currentIdx, setCurrentIdx]           = useState(0);
  const [spanishMode, setSpanishMode]         = useState(false);
  const [showTyping, setShowTyping]           = useState(false);
  const [typedAnswer, setTypedAnswer]         = useState('');
  const [typedSubmitted, setTypedSubmitted]   = useState(false);
  const [completion, setCompletion]           = useState<Record<string, boolean>>(
    () => (typeof window !== 'undefined' ? (getProgress(code)[assessmentId] ?? {}) : {}),
  );
  const [showCelebration, setShowCelebration] = useState(false);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const celebrationShownRef = useRef(false);
  const typingPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/codes/${code}`)
      .then(async res => {
        if (!res.ok) { setNotFound(true); return; }
        const data: AccessCode = await res.json();
        setCodeData(data);
        // Only track assessment_open for standalone assessments — bundles track when a child is selected
        const thisAssessment = data.assessments.find((a: Assessment) => a.id === assessmentId);
        const isBundle = thisAssessment?.type === 'bundle';
        if (!isPreview && !isBundle) track('assessment_open', code, { assessment_id: assessmentId });
      })
      .catch(() => setNotFound(true));
  }, [code, assessmentId]);

  useEffect(() => { if (notFound) router.replace('/assessment'); }, [notFound, router]);

  // Scroll typing panel into view on mobile when it opens
  useEffect(() => {
    if (showTyping && typingPanelRef.current) {
      setTimeout(() => {
        typingPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50); // slight delay so the panel has rendered
    }
  }, [showTyping]);


  if (!codeData) return null;

  const assessment = codeData.assessments.find(a => a.id === assessmentId) as Assessment | undefined;
  if (!assessment) { router.replace(`/assessment/${code}`); return null; }

  // Bundle: show version selector before player
  if ((assessment.type === 'bundle') && !selectedBenchmark) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden bg-white">
      {isPreview && <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5 tracking-wide flex-shrink-0">PREVIEW MODE — activity is not being tracked</div>}
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ background: '#1a2744' }}>
          <button onClick={() => router.push(`/assessment/${code}${isPreview ? '?preview=true' : ''}`)} className="text-white/60 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
            ← Back to assessments
          </button>
          <span className="text-white font-semibold text-sm">{assessment.title}</span>
          <div className="w-28" />
        </div>

        {/* Selector body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-3" style={{ background: assessment.badgeBg, color: assessment.badgeText }}>
              {assessment.typeLabel}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{assessment.title}</h1>
            <p className="text-sm text-gray-500 mb-8">{assessment.description}</p>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Choose one to begin</p>

            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {(assessment.childAssessments ?? []).map(child => (
                <button
                  key={child.id}
                  onClick={() => {
                    setSelectedBenchmark(child);
                    if (!isPreview) {
                      track('assessment_open', code, { assessment_id: child.id });
                      track('question_view', code, { assessment_id: child.id, question_id: child.questions[0]?.id });
                    }
                  }}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#e8735a] transition-all text-left group"
                >
                  {/* Scaled iframe preview */}
                  <div className="relative overflow-hidden bg-gray-100" style={{ height: 200 }}>
                    <iframe
                      src={child.questions[0]?.embedUrl}
                      style={{
                        width: '300%',
                        height: '600px',
                        transform: 'scale(0.333)',
                        transformOrigin: 'top left',
                        pointerEvents: 'none',
                        border: 'none',
                      }}
                      title={child.title}
                      tabIndex={-1}
                    />
                    {/* Gradient overlay + label */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent flex items-end p-4">
                      <div>
                        <span className="text-white font-bold text-base leading-tight block">{child.title}</span>
                        <span className="text-white/70 text-sm mt-0.5 block line-clamp-2">{child.playerLabel ?? child.description}</span>
                      </div>
                    </div>
                    {/* Hover play icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M3 2l9 5-9 5V2z" fill="#1a2744"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use selected child's questions if this is a bundle
  const activeAssessment = ((assessment.type === 'bundle') && selectedBenchmark) ? selectedBenchmark : assessment;

  const questions      = [...activeAssessment.questions].sort((a, b) => a.order - b.order);
  const currentQ       = questions[currentIdx];
  const completedCount = questions.filter(q => !!completion[q.id]).length;

  const switchBenchmark = (child: Assessment) => {
    setSelectedBenchmark(child);
    setShowTyping(false);
    setTypedAnswer('');
    setTypedSubmitted(false);
    celebrationShownRef.current = false;
    setShowCelebration(false);
    if (!isPreview) {
      track('assessment_open', code, { assessment_id: child.id });
      track('version_switch', code, { assessment_id: child.id });
    }
    // Clamp index if new assessment has fewer questions
    const childQuestions = [...child.questions].sort((a, b) => a.order - b.order);
    setCurrentIdx(prev => Math.min(prev, Math.max(0, childQuestions.length - 1)));
  };

  const goToQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setShowTyping(false);
    setShowSample(false);
    setTypedAnswer('');
    setTypedSubmitted(false);
    if (!isPreview) track('question_view', code, { assessment_id: activeAssessment.id, question_id: questions[idx].id });
  };

  const goPrev = () => goToQuestion(Math.max(0, currentIdx - 1));
  const goNext = () => goToQuestion(Math.min(questions.length - 1, currentIdx + 1));

  const finishQuestion = (qId: string, next: Record<string, boolean>) => {
    const nowAllDone = questions.every(q => !!next[q.id]);
    if (nowAllDone && !celebrationShownRef.current) {
      celebrationShownRef.current = true;
      if (!isPreview) track('assessment_complete', code, { assessment_id: activeAssessment.id });
      setTimeout(() => setShowCelebration(true), 400);
    }
    void qId;
  };

  const handleMarkComplete = () => {
    if (completion[currentQ.id]) return;
    if (!isPreview) markQuestionComplete(code, assessmentId, currentQ.id);
    const next = { ...completion, [currentQ.id]: true };
    setCompletion(next);
    if (!isPreview) track('question_complete', code, { assessment_id: activeAssessment.id, question_id: currentQ.id });
    finishQuestion(currentQ.id, next);
  };


  const handleTypedSubmit = () => {
    if (!typedAnswer.trim()) return;
    if (!isPreview) track('text_response', code, {
      assessment_id: activeAssessment.id,
      question_id: currentQ.id,
      metadata: { text: typedAnswer.trim() },
    });
    setTypedSubmitted(true);
    if (!completion[currentQ.id]) {
      if (!isPreview) markQuestionComplete(code, assessmentId, currentQ.id);
      const next = { ...completion, [currentQ.id]: true };
      setCompletion(next);
      if (!isPreview) track('question_complete', code, { assessment_id: activeAssessment.id, question_id: currentQ.id });
      finishQuestion(currentQ.id, next);
    }
  };

  const englishSample = currentQ.samples?.find(s => s.language === 'english'); // first EN
  const spanishSample = currentQ.samples?.find(s => s.language === 'spanish'); // first ES
  const sampleAvailable = !!englishSample;
  const hasSample = !!(showSample && sampleAvailable);
  const embedSrc = hasSample
    ? (spanishMode && spanishSample ? spanishSample.embedUrl : englishSample!.embedUrl)
    : (spanishMode && currentQ.spanishEmbedUrl ? currentQ.spanishEmbedUrl : currentQ.embedUrl);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-white">
      {isPreview && <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5 tracking-wide flex-shrink-0">PREVIEW MODE — activity is not being tracked</div>}
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ background: '#1a2744' }}>
        <button onClick={() => router.push(`/assessment/${code}${isPreview ? '?preview=true' : ''}`)} className="text-white/60 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
          ← Back to assessments
        </button>
        <div className="hidden md:flex items-center gap-2.5">
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: activeAssessment.badgeBg, color: activeAssessment.badgeText }}>
            {activeAssessment.typeLabel}
          </span>
          <span className="text-white font-semibold text-sm hidden sm:block">{activeAssessment.title}</span>
        </div>
        <span className="text-white/50 text-sm whitespace-nowrap">{completedCount} of {questions.length} complete</span>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside className="hidden md:flex w-60 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex-col">
          {/* Benchmark switcher (desktop) */}
          {(assessment.type === 'bundle') && assessment.childAssessments && (
            <div className="px-4 pt-4 pb-3 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Version</p>
              <div className="flex flex-col gap-1">
                {assessment.childAssessments.map((child, i) => (
                  <button
                    key={child.id}
                    onClick={() => switchBenchmark(child)}
                    className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedBenchmark?.id === child.id
                        ? 'bg-[#e8735a] text-white'
                        : 'text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1} – {child.playerLabel ?? child.description}
                  </button>
                ))}
              </div>
            </div>
          )}
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
        <div className="flex-1 flex flex-col overflow-y-auto">

          {/* Header + mode toggle strip */}
          <div className="flex-shrink-0 flex flex-col px-4 md:px-6 pt-3 pb-1 bg-gray-50 gap-1">
            <div className="flex items-start justify-between gap-3">
            {/* Mobile-only question info (left side) */}
            <div className="md:hidden flex-1 min-w-0">
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1" style={{ background: activeAssessment.badgeBg, color: activeAssessment.badgeText }}>
                {activeAssessment.typeLabel}
              </span>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Question {currentQ.order} of {questions.length}</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-snug">{currentQ.title}</p>
            </div>

            {/* Buttons (right side on mobile, full width column on desktop) */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0 md:flex-1">
              {currentQ.spanishEmbedUrl && (
                <Tooltip text="Other prompt languages can be configured for your population.">
                  <button
                    onClick={() => { setSpanishMode(m => !m); setShowTyping(false); setTypedAnswer(''); setTypedSubmitted(false); if (!isPreview) track('language_switch', code, { assessment_id: activeAssessment.id, question_id: currentQ.id, metadata: { language: spanishMode ? 'english' : 'spanish' } }); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
                    style={spanishMode ? { background: '#e8735a', color: 'white', outline: '2px solid #c75a3a' } : { background: '#e8735a', color: 'white' }}
                  >
                    <span>🌐</span> {spanishMode ? 'Try in English' : 'Try in Spanish'}
                  </button>
                </Tooltip>
              )}
              {/* Mobile version picker button */}
              {(assessment.type === 'bundle') && assessment.childAssessments && selectedBenchmark && (
                <div className="md:hidden mt-1">
                  <button
                    onClick={() => setVersionDropdownOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 active:bg-blue-100 transition-colors max-w-[220px]" style={{ color: '#4a6fa5' }}
                  >
                    <span className="truncate">
                      {assessment.childAssessments.findIndex(c => c.id === selectedBenchmark.id) + 1} – {selectedBenchmark.playerLabel ?? selectedBenchmark.description}
                    </span>
                    <svg className="w-3 h-3 flex-shrink-0 ml-0.5" style={{ color: '#4a6fa5' }} viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 1l4 4 4-4"/>
                    </svg>
                  </button>
                </div>
              )}

              {/* Mobile version bottom sheet */}
              {(assessment.type === 'bundle') && assessment.childAssessments && selectedBenchmark && versionDropdownOpen && (
                <div className="md:hidden">
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/40"
                    onClick={() => setVersionDropdownOpen(false)}
                  />
                  {/* Sheet */}
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <span className="text-sm font-semibold text-gray-800">Select a version</span>
                      <button
                        onClick={() => setVersionDropdownOpen(false)}
                        className="text-gray-400 hover:text-gray-600 p-1 -mr-1"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M5 5l10 10M15 5L5 15"/>
                        </svg>
                      </button>
                    </div>
                    <div className="py-2">
                      {assessment.childAssessments.map((child, i) => {
                        const isActive = child.id === selectedBenchmark.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => { switchBenchmark(child); setVersionDropdownOpen(false); }}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                              isActive ? 'bg-blue-50' : 'active:bg-gray-50'
                            }`}
                          >
                            <span className={`text-base flex-1 ${isActive ? 'font-semibold text-[#4a6fa5]' : 'text-gray-700'}`}>
                              {i + 1} – {child.playerLabel ?? child.description}
                            </span>
                            {isActive && (
                              <svg className="w-4 h-4 flex-shrink-0 text-[#4a6fa5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 6l3 3 5-5"/>
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Safe area spacer for notched phones */}
                    <div className="h-6" />
                  </div>
                </div>
              )}
              <Tooltip text="Customers may choose to enable typed responses as an alternative submission format to audio or video recording.">
                <button
                  onClick={() => { setShowTyping(t => !t); setSpanishMode(false); setTypedAnswer(''); setTypedSubmitted(false); if (!isPreview) track('format_change', code, { assessment_id: activeAssessment.id, question_id: currentQ.id, metadata: { format: showTyping ? 'video' : 'text' } }); }}
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
              {/* Desktop: sample button stays in right column */}
              {sampleAvailable && (
                <button
                  onClick={() => setShowSample(s => !s)}
                  className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.99]"
                  style={showSample ? { background: '#1D9E75', color: 'white', outline: '2px solid #0f6e50' } : { background: '#1D9E75', color: 'white' }}
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                    <circle cx="7.5" cy="7.5" r="6" stroke="white" strokeWidth="1.4"/>
                    <path d="M5.5 5.5l4 2-4 2V5.5z" fill="white"/>
                  </svg>
                  {showSample ? 'Back to question' : 'See a sample response'}
                </button>
              )}
            </div>
            </div>{/* end top row */}

            {/* Mobile: sample button left-aligned below */}
          </div>

          {/* Spanish language note — shown above embed when Spanish mode is active */}
          {spanishMode && (
            <p className="text-xs text-gray-400 text-center leading-relaxed px-4 pt-2 bg-gray-50">
              Other prompt languages can be configured for your population.
            </p>
          )}

          {/* iframe — fills height when no typing panel, scrolls with page when typing is open */}
          <div className={`flex justify-center px-4 md:px-16 py-4 bg-gray-50 ${showTyping ? 'flex-shrink-0' : 'flex-1 overflow-hidden'}`}>
            <iframe
              key={`${currentQ.id}-${spanishMode}`}
              src={embedSrc}
              allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *; display-capture *;"
              className={`w-full md:max-w-[720px] ${showTyping ? 'aspect-[3/4] md:aspect-[16/9]' : 'aspect-[3/4] md:aspect-auto md:h-full'}`}
              style={{ border: 'none', borderRadius: 16, display: 'block' }}
              title={currentQ.title}
            />
          </div>

          {/* Text input panel */}
          {showTyping && (
            <div ref={typingPanelRef} className="flex-shrink-0 flex justify-center px-4 md:px-16 pb-3 bg-gray-50">
              <div className="w-full md:max-w-[720px] bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{currentQ.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Type your response below</p>
                </div>
                <div className="p-4 space-y-3">
                  {typedSubmitted ? (
                    <div className="py-6 flex flex-col items-center gap-3 text-center">
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
                        rows={6}
                        style={{ height: 'auto' }}
                        className="w-full resize-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 block"
                      />
                      <button
                        onClick={handleTypedSubmit}
                        disabled={!typedAnswer.trim()}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: '#4a6fa5' }}
                      >
                        Submit Response
                      </button>
                      {/* Mobile-only context note (replaces hover tooltip) */}
                      <p className="md:hidden text-xs text-gray-400 text-center leading-relaxed">
                        Typed responses can be enabled as an alternative to audio or video recording.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom nav */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 md:px-6 py-3 flex flex-col items-stretch bg-white gap-2">
            {/* Mobile-only sample button row */}
            {sampleAvailable && (
              <button
                onClick={() => setShowSample(s => !s)}
                className="md:hidden flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
                style={showSample ? { background: '#1D9E75', color: 'white', outline: '2px solid #0f6e50' } : { background: '#1D9E75', color: 'white' }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="7.5" cy="7.5" r="6" stroke="white" strokeWidth="1.4"/>
                  <path d="M5.5 5.5l4 2-4 2V5.5z" fill="white"/>
                </svg>
                {showSample ? 'Back to question' : 'See a sample response'}
              </button>
            )}
          <div className="flex items-center justify-between gap-4">
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
              You&apos;ve completed all <strong>{questions.length}</strong> questions in <strong>{activeAssessment.title}</strong>.
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
