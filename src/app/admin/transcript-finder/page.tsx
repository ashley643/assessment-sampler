'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────
interface Transcript {
  id: string;
  nodeTitle: string;
  transcript: string;
  mediaType: 'video' | 'audio';
  mediaUrl: string;
  shareUrl: string | null;
  grade: string | null;
  gender: string | null;
  school: string | null;
  formTitle: string | null;
  wordCount: number;
  createdAt: string;
}

interface NeedsSample {
  questionId: string;
  questionTitle: string;
  questionText: string;
  assessmentId: string;
  assessmentTitle: string;
  typeLabel: string;
  missingEn: boolean;
  missingEs: boolean;
}

interface AssignedUrl {
  embedUrl: string;
  normalised: string;
  questionId: string;
  questionTitle: string;
}

const STOP_WORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','about','as','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','it','its','this','that','these','those','i','you','he','she','we','they','me','him','her','us','them','my','your','his','our','their','what','how','when','where','who','which','can','your','tell','me']);

function buildSearchTerms(title: string, questionText: string): string {
  const combined = `${title} ${questionText}`;
  const words = combined.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  // Deduplicate, take up to 6 most meaningful words
  return [...new Set(words)].slice(0, 6).join(' ');
}

interface AssignState {
  transcript: Transcript;
  questionId: string;
  language: 'english' | 'spanish';
  embedUrl: string;
  excerpt: string;
  grade: string;
  gender: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function wordCount(s: string) { return s.trim().split(/\s+/).filter(Boolean).length; }
function excerpt(s: string, n = 180) { return s.length > n ? s.slice(0, n).trim() + '…' : s; }

export default function TranscriptFinderPage() {
  const [transcripts, setTranscripts]   = useState<Transcript[]>([]);
  const [needsSamples, setNeedsSamples] = useState<NeedsSample[]>([]);
  const [needsLoading, setNeedsLoading]   = useState(true);
  const [assignedUrls, setAssignedUrls]   = useState<AssignedUrl[]>([]);
  const [loading, setLoading]             = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);

  // Filters
  const [mediaType, setMediaType] = useState<'video' | 'audio' | ''>('');
  const [minWords,  setMinWords]  = useState(40);
  const [search,    setSearch]    = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Sidebar
  const [focusQuestion, setFocusQuestion] = useState<string | null>(null);
  const [expandedAssessments, setExpandedAssessments] = useState<Set<string>>(new Set());

  // Keyword chips (only when a question is focused and no manual search override)
  const [activeKeywords, setActiveKeywords] = useState<Set<string>>(new Set());
  const [allKeywords, setAllKeywords] = useState<string[]>([]);

  // Assign modal
  const [assign, setAssign]         = useState<AssignState | null>(null);
  const [assigning, setAssigning]   = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assigned, setAssigned]     = useState<Set<string>>(new Set()); // transcript ids assigned this session

  // Expanded transcript
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Node-title filter (filter out irrelevant VideoAsk questions from results)
  const [hiddenNodeTitles, setHiddenNodeTitles] = useState<Set<string>>(new Set());

  const [fetchError, setFetchError] = useState('');

  // On mount: load only the questions-needing-samples list (our own DB, fast)
  useEffect(() => {
    fetch('/api/admin/transcript-finder?needsOnly=true')
      .then(r => r.json())
      .then(d => {
        const list = (d.needsSamples as NeedsSample[]) ?? [];
        setNeedsSamples(list);
        setExpandedAssessments(new Set(list.map(n => n.assessmentId)));
        setAssignedUrls((d.assignedUrls as AssignedUrl[]) ?? []);
        setNeedsLoading(false);
      })
      .catch(() => setNeedsLoading(false));
  }, []);

  // When a question is selected (or filters/search change): load matching transcripts
  const fetchTranscripts = useCallback(async (pg: number, replace: boolean) => {
    if (!focusQuestion && !search) return; // nothing to search on
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    setFetchError('');
    try {
      // If we have a focused question and no manual search, use active keyword chips
      let effectiveSearch = search;
      if (!search && focusQuestion) {
        effectiveSearch = [...activeKeywords].join(' ');
        if (!effectiveSearch) {
          // All keywords unchecked — nothing to search
          setLoading(false); setLoadingMore(false);
          setTranscripts([]); setHasMore(false);
          return;
        }
      }
      const params = new URLSearchParams({
        page: String(pg),
        minWords: String(minWords),
        ...(mediaType ? { mediaType } : {}),
        search: effectiveSearch,
      });
      const res = await fetch(`/api/admin/transcript-finder?${params}`);
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { setFetchError(`Server returned (${res.status}): ${text.slice(0, 300)}`); setLoading(false); setLoadingMore(false); return; }
      if (!res.ok) { setFetchError(`Error ${res.status}: ${(data.error as string) ?? JSON.stringify(data)}`); setLoading(false); setLoadingMore(false); return; }
      setTranscripts(prev => replace ? ((data.transcripts as Transcript[]) ?? []) : [...prev, ...((data.transcripts as Transcript[]) ?? [])]);
      setHasMore((data.hasMore as boolean) ?? false);
    } catch (e) {
      setFetchError(`Network error: ${e}`);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [focusQuestion, mediaType, minWords, search, needsSamples, activeKeywords]);

  // Reset node-title filter when question changes
  useEffect(() => { setHiddenNodeTitles(new Set()); }, [focusQuestion]);

  // When focused question changes, regenerate keyword chips
  useEffect(() => {
    if (focusQuestion && !search) {
      const focused = needsSamples.find(n => n.questionId === focusQuestion);
      if (focused) {
        const kws = buildSearchTerms(focused.questionTitle, focused.questionText).split(' ').filter(Boolean);
        setAllKeywords(kws);
        setActiveKeywords(new Set(kws));
      }
    } else {
      setAllKeywords([]);
      setActiveKeywords(new Set());
    }
  }, [focusQuestion, needsSamples, search]);

  useEffect(() => {
    setPage(1);
    setTranscripts([]);
    fetchTranscripts(1, true);
  }, [fetchTranscripts]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchTranscripts(next, false);
  }

  function openAssign(t: Transcript) {
    setAssign({
      transcript: t,
      questionId: focusQuestion ?? needsSamples[0]?.questionId ?? '',
      language: 'english',
      embedUrl: t.shareUrl ?? t.mediaUrl,
      excerpt: excerpt(t.transcript, 200),
      grade: t.grade ?? '',
      gender: t.gender ?? '',
    });
    setAssignError('');
  }

  async function submitAssign() {
    if (!assign) return;
    setAssigning(true);
    setAssignError('');
    const res = await fetch('/api/admin/transcript-finder/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: assign.questionId,
        language:   assign.language,
        embedUrl:   assign.embedUrl,
        mediaType:  assign.transcript.mediaType,
        grade:      assign.grade,
        gender:     assign.gender,
        excerpt:    assign.excerpt,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setAssignError(json.error ?? 'Failed'); setAssigning(false); return; }
    // Track this assignment so the card updates immediately
    const newUrl = assign.embedUrl;
    const newNorm = newUrl.split('?')[0];
    setAssignedUrls(prev => [
      // Remove any old entry for this url, then add the new one
      ...prev.filter(a => a.normalised !== newNorm),
      { embedUrl: newUrl, normalised: newNorm, questionId: assign.questionId, questionTitle: questionById[assign.questionId]?.questionTitle ?? '' },
    ]);
    setAssigned(prev => new Set([...prev, assign.transcript.id]));
    setAssign(null);
    setAssigning(false);
  }

  // Group needsSamples by assessment
  const byAssessment = needsSamples.reduce<Record<string, { title: string; typeLabel: string; questions: NeedsSample[] }>>((acc, n) => {
    if (!acc[n.assessmentId]) acc[n.assessmentId] = { title: n.assessmentTitle, typeLabel: n.typeLabel, questions: [] };
    acc[n.assessmentId].questions.push(n);
    return acc;
  }, {});

  // Question lookup
  const questionById = Object.fromEntries(needsSamples.map(n => [n.questionId, n]));

  const INPUT  = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20';
  const BTN_SM = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</Link>
        <h1 className="text-base font-semibold text-gray-900">Transcript Finder</h1>
        <div className="flex-1" />
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Min words</span>
            <select value={minWords} onChange={e => setMinWords(Number(e.target.value))} className={INPUT}>
              <option value={20}>20+</option>
              <option value={40}>40+</option>
              <option value={60}>60+</option>
              <option value={100}>100+</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            {(['', 'video', 'audio'] as const).map(t => (
              <button key={t} onClick={() => setMediaType(t)}
                className={`${BTN_SM} border ${mediaType === t ? 'bg-[#1a2744] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t === '' ? 'All' : t === 'video' ? '📹 Video' : '🎙 Audio'}
              </button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="flex gap-1">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search transcripts…"
              className={`${INPUT} w-52`}
            />
            <button type="submit" className={`${BTN_SM} bg-[#1a2744] text-white`}>Search</button>
            {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className={`${BTN_SM} bg-white border border-gray-200 text-gray-500`}>✕</button>}
          </form>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar: questions needing samples ── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions needing samples</p>
            <p className="text-xs text-gray-400 mt-0.5">{needsSamples.length} questions</p>
          </div>
          {needsLoading ? (
            <div className="px-4 py-6 text-xs text-gray-400">Loading…</div>
          ) : needsSamples.length === 0 ? (
            <div className="px-4 py-6 text-xs text-gray-400">All questions have samples 🎉</div>
          ) : (
            Object.entries(byAssessment).map(([aId, group]) => (
              <div key={aId}>
                <button
                  onClick={() => setExpandedAssessments(s => { const n = new Set(s); n.has(aId) ? n.delete(aId) : n.add(aId); return n; })}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700 leading-tight">{group.title}</span>
                  <span className="text-gray-400 text-xs ml-1">{expandedAssessments.has(aId) ? '▲' : '▼'}</span>
                </button>
                {expandedAssessments.has(aId) && group.questions.map(q => (
                  <button
                    key={q.questionId}
                    onClick={() => setFocusQuestion(focusQuestion === q.questionId ? null : q.questionId)}
                    className={`w-full text-left px-5 py-2 border-l-2 transition-colors ${
                      focusQuestion === q.questionId
                        ? 'border-[#1a2744] bg-[#1a2744]/5'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-xs text-gray-700 leading-snug">{q.questionTitle}</p>
                    <div className="flex gap-1 mt-1">
                      {q.missingEn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">needs EN</span>}
                      {q.missingEs && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">needs ES</span>}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </aside>

        {/* ── Main: transcript cards ── */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {focusQuestion && questionById[focusQuestion] && (
            <div className="mb-5 p-3 bg-[#1a2744]/5 border border-[#1a2744]/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#1a2744] uppercase tracking-wide">Searching for: </span>
                <span className="text-gray-800 font-medium text-sm">{questionById[focusQuestion].questionTitle}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-gray-500 text-xs">{questionById[focusQuestion].assessmentTitle}</span>
                <button onClick={() => setFocusQuestion(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">clear</button>
              </div>
              {questionById[focusQuestion].questionText && (
                <p className="text-xs text-gray-500 italic">{questionById[focusQuestion].questionText}</p>
              )}
              {!search && allKeywords.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-gray-400 mr-0.5">Keywords:</span>
                  {allKeywords.map(kw => {
                    const on = activeKeywords.has(kw);
                    return (
                      <button
                        key={kw}
                        onClick={() => setActiveKeywords(prev => {
                          const next = new Set(prev);
                          on ? next.delete(kw) : next.add(kw);
                          return next;
                        })}
                        className={`text-[11px] px-2 py-0.5 rounded-full border font-mono transition-colors ${
                          on
                            ? 'bg-[#1a2744] text-white border-transparent'
                            : 'bg-white text-gray-400 border-gray-200 line-through'
                        }`}
                      >
                        {kw}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {fetchError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 font-mono whitespace-pre-wrap">{fetchError}</div>
          ) : !focusQuestion && !search ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">←</div>
              <p className="text-gray-500 font-medium">Select a question to load matching transcripts</p>
              <p className="text-gray-400 text-sm max-w-sm">Transcripts will be filtered by the question title so you only see relevant responses.</p>
            </div>
          ) : loading ? (
            <div className="text-sm text-gray-400 py-10 text-center">Searching transcripts…</div>
          ) : transcripts.length === 0 ? (
            <div className="text-sm text-gray-400 py-10 text-center">No matching transcripts found. Try lowering the min word count or using the search bar.</div>
          ) : (
            <>
              {/* ── Questions asked filter ── */}
              {(() => {
                const uniqueTitles = [...new Set(transcripts.map(t => t.nodeTitle).filter(Boolean))];
                if (uniqueTitles.length < 2) return null;
                return (
                  <div className="mb-5 p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions asked — uncheck to hide</p>
                    <div className="space-y-1">
                      {uniqueTitles.map(title => {
                        const hidden = hiddenNodeTitles.has(title);
                        const count = transcripts.filter(t => t.nodeTitle === title).length;
                        return (
                          <label key={title} className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              onChange={() => setHiddenNodeTitles(prev => {
                                const next = new Set(prev);
                                hidden ? next.delete(title) : next.add(title);
                                return next;
                              })}
                              className="mt-0.5 accent-[#1a2744] flex-shrink-0"
                            />
                            <span className={`text-xs leading-snug ${hidden ? 'text-gray-300 line-through' : 'text-gray-700 group-hover:text-gray-900'}`}>
                              {title}
                              <span className="ml-1 text-gray-400 no-underline">({count})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const visible = transcripts.filter(t => !hiddenNodeTitles.has(t.nodeTitle));
                const hiddenCount = transcripts.length - visible.length;
                return (
                  <>
                    <p className="text-xs text-gray-400 mb-4">
                      {visible.length} transcripts shown{hiddenCount > 0 ? ` · ${hiddenCount} hidden by filter` : ''}
                    </p>
              <div className="space-y-4">
                {visible.map(t => {
                  const isExpanded  = expanded.has(t.id);
                  const isAssigned  = assigned.has(t.id);
                  const wc = t.wordCount || wordCount(t.transcript);
                  // Check if this transcript's URL already exists in question_samples
                  const tNorm = (t.shareUrl ?? t.mediaUrl).split('?')[0];
                  const existingAssignment = assignedUrls.find(a => a.normalised === tNorm);

                  return (
                    <div key={t.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                      isAssigned ? 'border-green-200 bg-green-50/30' :
                      existingAssignment ? 'border-amber-200 bg-amber-50/20' :
                      'border-gray-200'
                    }`}>
                      {/* Card header */}
                      <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.mediaType === 'audio' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.mediaType === 'audio' ? '🎙 Audio' : '📹 Video'}
                        </span>
                        {t.grade  && <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">Grade {t.grade}</span>}
                        {t.gender && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{t.gender}</span>}
                        <span className="text-xs text-gray-400">{wc} words</span>
                        {t.school     && <span className="text-xs text-gray-400 ml-auto truncate max-w-[200px]">{t.school}</span>}
                        {t.formTitle  && !t.school && <span className="text-xs text-gray-400 ml-auto truncate max-w-[200px]">{t.formTitle}</span>}
                        {isAssigned && <span className="text-xs font-semibold text-green-600 ml-auto">✓ Added this session</span>}
                        {!isAssigned && existingAssignment && (
                          <span className="text-xs font-semibold text-amber-600 ml-auto">
                            Already in: {existingAssignment.questionTitle}
                          </span>
                        )}
                      </div>

                      {/* Question asked */}
                      {t.nodeTitle && (
                        <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                          <p className="text-xs text-gray-500 font-medium">Question asked:</p>
                          <p className="text-xs text-gray-700 mt-0.5 italic">{t.nodeTitle}</p>
                        </div>
                      )}

                      {/* Video preview */}
                      {t.mediaType === 'video' && t.mediaUrl && (
                        <div className="px-5 pt-3 pb-1">
                          <video
                            autoPlay muted loop playsInline preload="auto"
                            src={t.mediaUrl}
                            className="rounded-xl bg-black"
                            style={{ width: '160px', aspectRatio: '9/16', objectFit: 'cover' }}
                          />
                        </div>
                      )}

                      {/* Audio preview */}
                      {t.mediaType === 'audio' && t.mediaUrl && (
                        <div className="px-5 pt-3 pb-1">
                          <audio controls preload="none" src={t.mediaUrl} className="w-full" style={{ height: '36px' }} />
                        </div>
                      )}

                      {/* Transcript */}
                      <div className="px-5 py-3">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {isExpanded ? t.transcript : excerpt(t.transcript, 280)}
                        </p>
                        {t.transcript.length > 280 && (
                          <button
                            onClick={() => setExpanded(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                            className="text-xs text-[#1a2744] underline mt-1"
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
                        {(t.shareUrl || t.mediaUrl) && (
                          <a href={t.shareUrl ?? t.mediaUrl} target="_blank" rel="noopener noreferrer"
                            className={`${BTN_SM} bg-white border border-gray-200 text-gray-600 hover:border-gray-300`}>
                            Watch / Listen ↗
                          </a>
                        )}
                        {isAssigned ? (
                          <span className={`${BTN_SM} bg-green-100 text-green-700 cursor-default`}>✓ Assigned</span>
                        ) : existingAssignment ? (
                          <button onClick={() => openAssign(t)} className={`${BTN_SM} bg-amber-500 text-white hover:bg-amber-600`}>
                            Reassign →
                          </button>
                        ) : (
                          <button onClick={() => openAssign(t)} className={`${BTN_SM} bg-[#1a2744] text-white hover:bg-[#243660]`}>
                            Assign to question →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="mt-8 text-center">
                  <button onClick={loadMore} disabled={loadingMore}
                    className="px-6 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-gray-300 shadow-sm transition-all disabled:opacity-50">
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
                  </>
                );
              })()}
            </>
          )}
        </main>
      </div>

      {/* ── Assign modal ── */}
      {assign && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setAssign(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90dvh] flex flex-col">
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">Assign transcript to a question</h2>
                <button onClick={() => setAssign(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M5 5l10 10M15 5L5 15"/>
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* Transcript preview */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${assign.transcript.mediaType === 'audio' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                      {assign.transcript.mediaType === 'audio' ? '🎙 Audio' : '📹 Video'}
                    </span>
                    {assign.transcript.grade  && <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">Grade {assign.transcript.grade}</span>}
                    {assign.transcript.gender && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{assign.transcript.gender}</span>}
                    <span className="text-xs text-gray-400">{assign.transcript.wordCount} words</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{excerpt(assign.transcript.transcript, 300)}</p>
                  {(assign.transcript.shareUrl || assign.transcript.mediaUrl) && (
                    <a href={assign.transcript.shareUrl ?? assign.transcript.mediaUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#1a2744] underline mt-2 inline-block">
                      Watch / Listen ↗
                    </a>
                  )}
                </div>

                {/* Question picker */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Assign to question</label>
                  <select
                    value={assign.questionId}
                    onChange={e => setAssign(a => a ? { ...a, questionId: e.target.value } : a)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                  >
                    <option value="">— Pick a question —</option>
                    {Object.entries(byAssessment).map(([, group]) => (
                      <optgroup key={group.title} label={group.title}>
                        {group.questions.map(q => (
                          <option key={q.questionId} value={q.questionId}>
                            {q.questionTitle} {q.missingEn && q.missingEs ? '(needs EN + ES)' : q.missingEn ? '(needs EN)' : '(needs ES)'}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Language of response</label>
                  <div className="flex gap-2">
                    {(['english', 'spanish'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setAssign(a => a ? { ...a, language: lang } : a)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          assign.language === lang
                            ? lang === 'english' ? 'bg-blue-600 text-white border-transparent' : 'bg-orange-500 text-white border-transparent'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {lang === 'english' ? 'English' : 'Spanish'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grade + Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Grade</label>
                    <select
                      value={assign.grade}
                      onChange={e => setAssign(a => a ? { ...a, grade: e.target.value } : a)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                    >
                      <option value="">— Unknown —</option>
                      {['TK','K','1','2','3','4','5','6','7','8','9','10','11','12','Parent','Staff'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Gender</label>
                    <select
                      value={assign.gender}
                      onChange={e => setAssign(a => a ? { ...a, gender: e.target.value } : a)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                    >
                      <option value="">— Unknown —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="nonbinary">Non-binary</option>
                    </select>
                  </div>
                </div>

                {/* Embed URL */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Embed URL
                    <span className="font-normal text-gray-400 ml-1">— paste a VideoAsk share link if needed</span>
                  </label>
                  <input
                    value={assign.embedUrl}
                    onChange={e => setAssign(a => a ? { ...a, embedUrl: e.target.value } : a)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20"
                    placeholder="https://www.videoask.com/..."
                  />
                </div>

                {/* Excerpt */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Excerpt shown on feed
                    <span className="font-normal text-gray-400 ml-1">— edit to pick the best quote</span>
                  </label>
                  <textarea
                    value={assign.excerpt}
                    onChange={e => setAssign(a => a ? { ...a, excerpt: e.target.value } : a)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20 resize-none"
                  />
                </div>

                {assignError && <p className="text-xs text-red-500">{assignError}</p>}
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
                <button onClick={() => setAssign(null)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
                <button
                  onClick={submitAssign}
                  disabled={assigning || !assign.questionId || !assign.embedUrl}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#1a2744] text-white hover:bg-[#243660] disabled:opacity-50 transition-colors"
                >
                  {assigning ? 'Saving…' : 'Add to question →'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
