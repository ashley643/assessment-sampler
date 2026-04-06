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

interface FeaturedSample {
  embedUrl: string;
  mediaType: string;
  excerpt: string;
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
  featuredEn: FeaturedSample | null;
  featuredEs: FeaturedSample | null;
}

interface AssignedUrl {
  embedUrl: string;
  normalised: string;
  questionId: string;
  questionTitle: string;
}

const STOP_WORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','about','as','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','it','its','this','that','these','those','i','you','he','she','we','they','me','him','her','us','them','my','your','his','our','their','what','how','when','where','who','which','can','your','tell','me']);

// Per-competency keyword sets — all single words only (multi-word phrases split into noise)
// English fallback vocab for when questionText isn't populated in the DB
const ENGLISH_BY_TOPIC: Record<string, string[]> = {
  curiosity:        ['curious','wonder','notice','noticed','question','explore','discover','interesting','fascinating','investigate'],
  curious:          ['curious','wonder','notice','noticed','question','explore','discover','interesting','fascinating','investigate'],
  purpose:          ['love','passion','meaningful','doing','feels','right','natural','perfect','matters','important','enjoy','sense'],
  grit:             ['challenging','difficult','hard','struggle','kept','trying','practice','persevere','refused','quit','failure','harder','push'],
  gratitude:        ['grateful','thankful','appreciate','inspired','thankful','recognize','blessing','lucky','fortunate','thank'],
  compassion:       ['kindness','helped','caring','felt','needed','support','empathy','understand','sadness','others','compassionate'],
  'self-control':   ['calm','control','pause','waited','patience','impulse','breathe','reaction','tempted','stopped','cool'],
  'self control':   ['calm','control','pause','waited','patience','impulse','breathe','reaction','tempted','stopped','cool'],
  'perspective-taking': ['perspective','point','view','understand','imagine','changed','mind','annoyed','side','story','empathy','different'],
  'perspective taking': ['perspective','point','view','understand','imagine','changed','mind','annoyed','side','story','empathy','different'],
  'growth mindset': ['believe','improve','mistake','effort','possible','transform','mindset','brain','grow','feedback','challenge','better'],
  growth:           ['grow','better','change','improve','mistake','effort','learn','transform','progress','developed'],
  'reflective growth': ['learned','grew','changed','different','before','now','realized','understand','lesson','experience','improved'],
  resilience:       ['bounce','recover','setback','overcome','strong','returned','manage','support','difficult','bounced'],
  'relational awareness': ['noticed','emotion','feeling','expressed','communicate','understand','friend','supported','aware','picked'],
  'emotional resilience': ['recover','overcome','strong','manage','emotion','difficult','bounced','returned','support','feeling'],
  'effective help-seeking': ['asked','help','seek','resource','investigate','teacher','friend','family','learned','figured'],
  'conflict resolution': ['conflict','resolve','talk','calm','situation','problem','solution','agreement','fix','forgive','reconcile'],
  belonging:        ['belong','included','community','group','welcome','accepted','connected','part','friends','fit'],
  'self-esteem':    ['confident','proud','value','believe','capable','strength','good','like','myself','worthy'],
  empathy:          ['empathy','felt','understand','imagine','place','listen','shared','supported','cared','compassion'],
  resilient:        ['resilient','recover','strength','overcome','refused','bounced','continued','pushed'],
  kind:             ['kind','kindness','helped','supported','cared','compassion','gentle','considerate'],
  confident:        ['confident','confidence','believe','capable','strength','proud','able','achieved'],
  connected:        ['connected','connect','related','community','belonging','friends','together','part'],
  capable:          ['capable','able','achieved','skill','strength','improved','learned','accomplished'],
  knowledgeable:    ['knowledge','learned','know','understand','studied','investigated','discovered'],
};

// Spanish vocabulary per competency — single words only
const SPANISH_BY_TOPIC: Record<string, string[]> = {
  curiosity:        ['curiosidad','curioso','curiosa','preguntas','pregunto','descubrí','explorar','averiguar','asombro','interesante','fascinante','investigar','aprendí','noté'],
  curious:          ['curiosidad','curioso','curiosa','preguntas','pregunto','descubrí','explorar','averiguar','asombro','interesante','fascinante','investigar','aprendí','noté'],
  purpose:          ['propósito','amo','amor','apasiona','pasión','significa','significado','siento','sentido','gusta','disfruto','disfrutar','natural','correcto','vida','feliz'],
  grit:             ['difícil','desafío','reto','esfuerzo','perseverancia','intenté','seguí','continué','mejoré','practiqué','fracasé','aguanté','rendirse','practicar'],
  gratitude:        ['gratitud','agradecido','agradecida','gracias','agradecer','aprecio','apreciar','valoro','valorar','afortunado','suerte','bendecido','reconocer','inspiró'],
  compassion:       ['compasión','ayudé','sentí','necesitaba','apoyo','apoyé','cuidar','empatía','entendí','tristeza','solidaridad','ayudar'],
  'self-control':   ['autocontrol','calmarme','calma','control','detuve','respiré','paciencia','esperé','impulsivo','reaccioné','tranquilo','tranquilidad','calmado','contuve'],
  'self control':   ['autocontrol','calmarme','calma','control','detuve','respiré','paciencia','esperé','impulsivo','reaccioné','tranquilo','tranquilidad','calmado','contuve'],
  'perspective-taking': ['perspectiva','entender','comprender','empatía','imaginar','sentía','pensaba','diferente','comprensión','opinión'],
  'perspective taking': ['perspectiva','entender','comprender','empatía','imaginar','sentía','pensaba','diferente','comprensión','opinión'],
  'growth mindset': ['mentalidad','crecer','mejoré','error','errores','cambié','crecimiento','posible','puedo','logré','esfuerzo','practicando','transformar'],
  growth:           ['crecimiento','crecer','mejoré','error','errores','cambié','posible','puedo','logré','esfuerzo','practicando','transformar'],
  'reflective growth': ['reflexioné','aprendí','crecí','cambié','diferente','mejor','comprendo','lección','experiencia','mejoré','cuenta'],
  resilience:       ['resiliencia','recuperé','superé','fuerza','fuerte','volví','manejar','apoyo','rendirse'],
  'relational awareness': ['noté','sentía','emoción','emociones','expresaba','comunicar','entender','comprender','ayudé','apoyo','amigo','cuenta'],
  'emotional resilience': ['resiliencia','recuperé','superé','fuerza','fuerte','volví','manejar','apoyo','emoción','sentí','manejé'],
  'effective help-seeking': ['busqué','pregunté','recurso','investigué','maestro','amigo','familia','aprendí','apoyo'],
  'conflict resolution': ['conflicto','resolver','resolví','hablé','calmar','problema','solución','acuerdo','arreglé','perdonar','reconciliar'],
  belonging:        ['pertenecer','pertenencia','incluido','comunidad','grupo','amigos','bienvenido','aceptado','conexión','conectar'],
  'self-esteem':    ['seguro','confianza','orgulloso','valoro','capaz','puedo','fuerza'],
  empathy:          ['empatía','comprendí','imaginar','entendí','compartir','apoyé','escuché','sentía'],
  resilient:        ['resiliente','recuperé','fuerza','superar','volví','continué'],
  kind:             ['amable','amabilidad','bondad','ayudé','apoyé','cuidé','compasión','gentil','considerado'],
  confident:        ['seguro','confianza','capaz','fuerza','orgulloso','puedo','logré'],
  connected:        ['conexión','conectar','relacioné','comunidad','pertenencia','amigos','juntos'],
  capable:          ['capaz','puedo','logré','habilidad','fuerza','mejoré','aprendí','conseguí'],
  knowledgeable:    ['conocimiento','aprendí','saber','entender','comprender','estudié','investigué','descubrí'],
};

function buildSearchTerms(title: string, questionText: string): { en: string[], es: string[] } {
  const titleKey = title.toLowerCase().trim();

  const fromQuestion = questionText
    ? [...new Set(questionText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)))]
    : [];
  const fallbackEn = ENGLISH_BY_TOPIC[titleKey]
    ?? Object.entries(ENGLISH_BY_TOPIC).find(([k]) => titleKey.includes(k) || k.includes(titleKey))?.[1]
    ?? [];
  const en = [...new Set([...fromQuestion, ...fallbackEn])].slice(0, 10);

  const esSet = SPANISH_BY_TOPIC[titleKey]
    ?? Object.entries(SPANISH_BY_TOPIC).find(([k]) => titleKey.includes(k) || k.includes(titleKey))?.[1]
    ?? [];
  const es = esSet.slice(0, 8);

  return { en, es };
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
  const [allQuestions, setAllQuestions] = useState<NeedsSample[]>([]);
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
  const [openSearchMode, setOpenSearchMode] = useState(false);
  const [expandedAssessments, setExpandedAssessments] = useState<Set<string>>(new Set());

  // Keyword chips — state: absent=off, 'or'=any hit counts, 'must'=required AND
  const [enKeywords,     setEnKeywords]     = useState<string[]>([]);
  const [esKeywords,     setEsKeywords]     = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [keywordStates,  setKeywordStates]  = useState<Map<string, 'or' | 'must'>>(new Map());
  const [keywordLang,    setKeywordLang]    = useState<'all' | 'en' | 'es'>('all');

  // Results metadata
  const [totalCount,     setTotalCount]     = useState<number | null>(null);
  const [allNodeTitles,  setAllNodeTitles]  = useState<{ title: string; count: number }[]>([]);

  // Assign modal
  const [assign, setAssign]         = useState<AssignState | null>(null);
  const [assigning, setAssigning]   = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assigned, setAssigned]     = useState<Set<string>>(new Set()); // transcript ids assigned this session

  // Expanded transcript
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Show existing samples panel in focus bar
  const [showExisting, setShowExisting] = useState(false);

  // Node-title filter (filter out irrelevant VideoAsk questions from results)
  const [hiddenNodeTitles, setHiddenNodeTitles] = useState<Set<string>>(new Set());

  const [fetchError, setFetchError] = useState('');

  // Load/refresh the questions-needing-samples list
  const refreshNeeds = useCallback((showSpinner = false) => {
    if (showSpinner) setNeedsLoading(true);
    fetch('/api/admin/response-finder?needsOnly=true')
      .then(r => r.json())
      .then(d => {
        const list = (d.needsSamples as NeedsSample[]) ?? [];
        setNeedsSamples(list);
        setExpandedAssessments(prev => {
          // Keep existing expanded state, just add any new assessments
          const next = new Set(prev);
          list.forEach(n => next.add(n.assessmentId));
          return next;
        });
        setAllQuestions((d.allQuestions as NeedsSample[]) ?? []);
        setAssignedUrls((d.assignedUrls as AssignedUrl[]) ?? []);
        setNeedsLoading(false);
      })
      .catch(() => setNeedsLoading(false));
  }, []);

  // On mount
  useEffect(() => { refreshNeeds(true); }, [refreshNeeds]);

  // When a question is selected (or filters/search change): load matching transcripts
  const fetchTranscripts = useCallback(async (pg: number, replace: boolean) => {
    if (!focusQuestion && !search && !openSearchMode) return; // nothing to search on
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    setFetchError('');
    try {
      // If we have a focused question or open search mode and no manual search, use keyword chips filtered by lang
      let effectiveSearch = search;
      let mustSearch = '';
      if (!search && (focusQuestion || openSearchMode)) {
        const inLang = (kw: string) => {
          if (keywordLang === 'en') return enKeywords.includes(kw) || customKeywords.includes(kw);
          if (keywordLang === 'es') return esKeywords.includes(kw) || customKeywords.includes(kw);
          return true;
        };
        const orKws   = [...keywordStates.entries()].filter(([kw, s]) => s === 'or'   && inLang(kw)).map(([kw]) => kw);
        const mustKws = [...keywordStates.entries()].filter(([kw, s]) => s === 'must' && inLang(kw)).map(([kw]) => kw);
        effectiveSearch = orKws.join(' ');
        mustSearch      = mustKws.join(' ');
        if (!effectiveSearch && !mustSearch) {
          setLoading(false); setLoadingMore(false);
          setTranscripts([]); setHasMore(false);
          setTotalCount(0);
          return;
        }
      }
      const params = new URLSearchParams({
        page: String(pg),
        minWords: String(minWords),
        ...(mediaType ? { mediaType } : {}),
        search: effectiveSearch,
        ...(mustSearch ? { must: mustSearch } : {}),
      });
      const res = await fetch(`/api/admin/response-finder?${params}`);
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { setFetchError(`Server returned (${res.status}): ${text.slice(0, 300)}`); setLoading(false); setLoadingMore(false); return; }
      if (!res.ok) { setFetchError(`Error ${res.status}: ${(data.error as string) ?? JSON.stringify(data)}`); setLoading(false); setLoadingMore(false); return; }
      setTranscripts(prev => replace ? ((data.transcripts as Transcript[]) ?? []) : [...prev, ...((data.transcripts as Transcript[]) ?? [])]);
      setHasMore((data.hasMore as boolean) ?? false);
      if (replace) {
        setTotalCount((data.totalCount as number) ?? null);
        setAllNodeTitles((data.allNodeTitles as { title: string; count: number }[]) ?? []);
      }
    } catch (e) {
      setFetchError(`Network error: ${e}`);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [focusQuestion, openSearchMode, mediaType, minWords, search, needsSamples, keywordStates, keywordLang, enKeywords, esKeywords, customKeywords]);

  // Reset filters when question or mode changes
  useEffect(() => {
    setHiddenNodeTitles(new Set());
    setKeywordLang('all');
    setTotalCount(null);
    setAllNodeTitles([]);
    setShowExisting(false);
  }, [focusQuestion, openSearchMode]);

  // When focused question changes, regenerate keyword chips; open search starts with blank chips
  useEffect(() => {
    if (focusQuestion && !search) {
      const focused = needsSamples.find(n => n.questionId === focusQuestion);
      if (focused) {
        const { en, es } = buildSearchTerms(focused.questionTitle, focused.questionText);
        setEnKeywords(en);
        setEsKeywords(es);
        setCustomKeywords([]);
        const initMap = new Map<string, 'or' | 'must'>();
        [...en, ...es].forEach(kw => initMap.set(kw, 'or'));
        setKeywordStates(initMap);
      }
    } else if (openSearchMode) {
      // Open search: user builds chips manually — don't touch customKeywords/keywordStates
      // enKeywords/esKeywords stay empty; setting them here would cause spurious re-fetches
    } else {
      setEnKeywords([]); setEsKeywords([]); setCustomKeywords([]);
      setKeywordStates(new Map());
    }
  }, [focusQuestion, openSearchMode, needsSamples, search]);

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

  function openAssign(t: Transcript, prefilledQuestionId?: string) {
    setAssign({
      transcript: t,
      questionId: prefilledQuestionId ?? focusQuestion ?? needsSamples[0]?.questionId ?? '',
      language: 'english',
      embedUrl: t.shareUrl ?? t.mediaUrl,
      excerpt: t.transcript,
      grade: t.grade ?? '',
      gender: t.gender ?? '',
    });
    setAssignError('');
  }

  async function submitAssign() {
    if (!assign) return;
    setAssigning(true);
    setAssignError('');
    const res = await fetch('/api/admin/response-finder/assign', {
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
    // Refresh sidebar so needs EN/ES badges update
    refreshNeeds();
  }

  async function removeAssignment(embedUrl: string, transcriptId: string) {
    const res = await fetch('/api/admin/response-finder/assign', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedUrl }),
    });
    if (!res.ok) return;
    const norm = embedUrl.split('?')[0];
    setAssignedUrls(prev => prev.filter(a => a.normalised !== norm));
    setAssigned(prev => { const n = new Set(prev); n.delete(transcriptId); return n; });
    refreshNeeds();
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</Link>
        <h1 className="text-base font-semibold text-gray-900">Response Finder</h1>
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
          {/* Open Search button */}
          <button
            onClick={() => {
              setOpenSearchMode(m => !m);
              setFocusQuestion(null);
              setCustomKeywords([]);
              setKeywordStates(new Map());
            }}
            className={`w-full text-left px-4 py-3 flex items-center gap-2.5 border-b transition-colors ${
              openSearchMode
                ? 'bg-[#1a2744] text-white border-[#1a2744]'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-100'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="6" cy="6" r="4.5"/>
              <path d="M9.5 9.5l3 3"/>
            </svg>
            <span className="text-xs font-semibold">Open Search</span>
            {openSearchMode && <span className="ml-auto text-[10px] opacity-70">active</span>}
          </button>
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
                    onClick={() => { setOpenSearchMode(false); setFocusQuestion(focusQuestion === q.questionId ? null : q.questionId); }}
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

        {/* ── Main: focus bar (pinned) + scrollable transcript cards ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Open Search focus bar */}
          {openSearchMode && !focusQuestion && (
            <div className="flex-shrink-0 px-6 pt-4 pb-0 bg-gray-50 border-b border-[#1a2744]/10">
              <div className="p-3 bg-[#eef0f5] border border-[#1a2744]/20 rounded-xl space-y-2 shadow-sm mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#1a2744" strokeWidth="1.8">
                    <circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5l3 3"/>
                  </svg>
                  <span className="text-xs font-semibold text-[#1a2744] uppercase tracking-wide">Open Search</span>
                  <span className="text-gray-400 text-xs">— search all transcripts by keyword</span>
                  <button onClick={() => { setOpenSearchMode(false); setCustomKeywords([]); setKeywordStates(new Map()); }} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">clear</button>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-400">click chip: off → OR →</span>
                    <span className="text-[10px] font-bold text-emerald-600">★ MUST</span>
                  </div>
                  {customKeywords.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {customKeywords.map(kw => {
                        const st = keywordStates.get(kw);
                        return (
                          <button key={kw}
                            title={st === 'or' ? 'Click to make MUST-HAVE' : st === 'must' ? 'Click to turn off' : 'Click to add as OR'}
                            onClick={() => setKeywordStates(prev => {
                              const n = new Map(prev);
                              if (!st) n.set(kw, 'or');
                              else if (st === 'or') n.set(kw, 'must');
                              else n.delete(kw);
                              return n;
                            })}
                            className={`text-[11px] px-2 py-0.5 rounded-full border font-mono transition-colors ${
                              st === 'must' ? 'bg-emerald-500 text-white border-transparent font-bold ring-1 ring-emerald-400 ring-offset-1' :
                              st === 'or'   ? 'bg-[#1a2744] text-white border-transparent' :
                                             'bg-white text-gray-400 border-gray-200 line-through'
                            }`}>
                            {st === 'must' ? `★ ${kw}` : kw}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem('kw') as HTMLInputElement;
                      const val = input.value.trim().toLowerCase();
                      if (val && !customKeywords.includes(val)) {
                        setCustomKeywords(prev => [...prev, val]);
                        setKeywordStates(prev => { const n = new Map(prev); n.set(val, 'or'); return n; });
                      }
                      input.value = '';
                    }}
                    className="flex items-center gap-1"
                  >
                    <input name="kw" placeholder="type a keyword and press Enter…"
                      className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-dashed border-gray-300 bg-white text-gray-500 w-52 focus:outline-none focus:border-[#1a2744]/40 placeholder:text-gray-300"
                      autoFocus
                    />
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Focus bar — always visible, never scrolls */}
          {focusQuestion && questionById[focusQuestion] && (
            <div className="flex-shrink-0 px-6 pt-4 pb-0 bg-gray-50 border-b border-[#1a2744]/10">
              <div className="p-3 bg-[#eef0f5] border border-[#1a2744]/20 rounded-xl space-y-2 shadow-sm mb-4">
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
              {/* Existing assigned samples for this question */}
              {(() => {
                const q = questionById[focusQuestion];
                const hasEn = !!q.featuredEn;
                const hasEs = !!q.featuredEs;
                if (!hasEn && !hasEs) return (
                  <p className="text-[10px] text-gray-400">No samples assigned yet.</p>
                );
                return (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowExisting(v => !v)}
                      className="text-[11px] font-medium text-[#1a2744]/70 hover:text-[#1a2744] underline"
                    >
                      {showExisting ? '▲ Hide current samples' : `▼ View current samples (${[hasEn, hasEs].filter(Boolean).length})`}
                    </button>
                    {showExisting && (
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        {[{ lang: 'EN', sample: q.featuredEn }, { lang: 'ES', sample: q.featuredEs }]
                          .filter(({ sample }) => !!sample)
                          .map(({ lang, sample }) => (
                            <div key={lang} className="bg-white rounded-lg border border-gray-200 p-2 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lang === 'EN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{lang}</span>
                                <span className="text-[10px] text-gray-400">{sample!.mediaType}</span>
                                <span className="text-[10px] font-semibold text-green-600 ml-auto">★ Featured</span>
                              </div>
                              {sample!.excerpt && (
                                <p className="text-[11px] text-gray-600 italic leading-relaxed">&ldquo;{sample!.excerpt.slice(0, 160)}{sample!.excerpt.length > 160 ? '…' : ''}&rdquo;</p>
                              )}
                              {sample!.mediaType === 'audio' ? (
                                <audio controls preload="none" src={sample!.embedUrl} className="w-full" style={{ height: '32px' }} />
                              ) : (
                                <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                                  <iframe src={sample!.embedUrl} allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *;" className="w-full h-full" style={{ border: 'none' }} loading="lazy" title={`${lang} featured sample`} />
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              {!search && (
                <div className="space-y-1.5 pt-0.5">
                  {/* Language toggle + chip legend — only show if there are auto-generated chips */}
                  {(enKeywords.length > 0 || esKeywords.length > 0) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-gray-400">Search:</span>
                      {(['all', 'en', 'es'] as const).map(lang => (
                        <button key={lang} onClick={() => setKeywordLang(lang)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${keywordLang === lang ? 'bg-[#1a2744] text-white border-transparent' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                          {lang === 'all' ? 'EN + ES' : lang === 'en' ? 'EN only' : 'ES only'}
                        </button>
                      ))}
                      <span className="text-[10px] text-gray-400 ml-2">· click chip: off → OR →</span>
                      <span className="text-[10px] font-bold text-emerald-600">★ MUST</span>
                    </div>
                  )}
                  {(enKeywords.length === 0 && esKeywords.length === 0) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">click chip: off → OR →</span>
                      <span className="text-[10px] font-bold text-emerald-600">★ MUST</span>
                    </div>
                  )}
                  {/* Chip rows */}
                  {[{ label: 'EN', words: enKeywords, dimmed: keywordLang === 'es' },
                    { label: 'ES', words: esKeywords, dimmed: keywordLang === 'en' },
                    { label: '+', words: customKeywords, dimmed: false }]
                    .filter(g => g.words.length > 0)
                    .map(({ label, words, dimmed }) => (
                      <div key={label} className={`flex items-center gap-1.5 flex-wrap transition-opacity ${dimmed ? 'opacity-30' : ''}`}>
                        <span className="text-[10px] font-bold text-gray-400 w-4">{label}</span>
                        {words.map(kw => {
                          const st = keywordStates.get(kw); // 'or' | 'must' | undefined=off
                          return (
                            <button key={kw}
                              title={st === 'or' ? 'Click to make MUST-HAVE' : st === 'must' ? 'Click to turn off' : 'Click to add as OR'}
                              onClick={() => setKeywordStates(prev => {
                                const n = new Map(prev);
                                if (!st) n.set(kw, 'or');
                                else if (st === 'or') n.set(kw, 'must');
                                else n.delete(kw);
                                return n;
                              })}
                              className={`text-[11px] px-2 py-0.5 rounded-full border font-mono transition-colors ${
                                st === 'must' ? 'bg-emerald-500 text-white border-transparent font-bold ring-1 ring-emerald-400 ring-offset-1' :
                                st === 'or'   ? 'bg-[#1a2744] text-white border-transparent' :
                                               'bg-white text-gray-400 border-gray-200 line-through'
                              }`}>
                              {st === 'must' ? `★ ${kw}` : kw}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  {/* Manual keyword adder */}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem('kw') as HTMLInputElement;
                      const val = input.value.trim().toLowerCase();
                      if (val && !customKeywords.includes(val) && !enKeywords.includes(val) && !esKeywords.includes(val)) {
                        setCustomKeywords(prev => [...prev, val]);
                        setKeywordStates(prev => { const n = new Map(prev); n.set(val, 'or'); return n; });
                      }
                      input.value = '';
                    }}
                    className="flex items-center gap-1"
                  >
                    <span className="text-[10px] font-bold text-gray-400 w-4">+</span>
                    <input name="kw" placeholder="add keyword…"
                      className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-dashed border-gray-300 bg-white text-gray-500 w-28 focus:outline-none focus:border-[#1a2744]/40 placeholder:text-gray-300"
                    />
                  </form>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Scrollable transcript cards */}
          <main className="flex-1 overflow-y-auto px-6 py-6">

          {fetchError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 font-mono whitespace-pre-wrap">{fetchError}</div>
          ) : !focusQuestion && !search && !openSearchMode ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">←</div>
              <p className="text-gray-500 font-medium">Select a question to load matching transcripts</p>
              <p className="text-gray-400 text-sm max-w-sm">Or use <strong>Open Search</strong> in the sidebar to search all transcripts by keyword.</p>
            </div>
          ) : openSearchMode && !search && keywordStates.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">🔍</div>
              <p className="text-gray-500 font-medium">Type a keyword above to start searching</p>
              <p className="text-gray-400 text-sm max-w-sm">Add keywords one at a time. Set them to OR (any match) or ★ MUST (all required).</p>
            </div>
          ) : loading ? (
            <div className="text-sm text-gray-400 py-10 text-center">Searching transcripts…</div>
          ) : transcripts.length === 0 ? (
            <div className="text-sm text-gray-400 py-10 text-center">No matching transcripts found. Try lowering the min word count or using the search bar.</div>
          ) : (
            <>
              {/* ── Questions asked filter (from full search, not just current page) ── */}
              {allNodeTitles.length >= 2 && (
                <div className="mb-5 p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Questions asked — uncheck to hide
                    {totalCount !== null && <span className="ml-2 font-normal normal-case text-gray-400">({totalCount} total matches)</span>}
                  </p>
                  <div className="space-y-1">
                    {allNodeTitles.map(({ title, count }) => {
                      const hidden = hiddenNodeTitles.has(title);
                      return (
                        <label key={title} className="flex items-start gap-2 cursor-pointer group">
                          <input type="checkbox" checked={!hidden}
                            onChange={() => setHiddenNodeTitles(prev => { const n = new Set(prev); hidden ? n.delete(title) : n.add(title); return n; })}
                            className="mt-0.5 accent-[#1a2744] flex-shrink-0"
                          />
                          <span className={`text-xs leading-snug ${hidden ? 'text-gray-300 line-through' : 'text-gray-700 group-hover:text-gray-900'}`}>
                            {title}
                            <span className="ml-1 text-gray-400">({count})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const visible = transcripts.filter(t => !hiddenNodeTitles.has(t.nodeTitle));
                const hiddenCount = transcripts.length - visible.length;
                return (
                  <>
                    <p className="text-xs text-gray-400 mb-4">
                      {totalCount !== null ? `${totalCount} total · ` : ''}{visible.length} shown on this page{hiddenCount > 0 ? ` · ${hiddenCount} hidden by filter` : ''}
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
                      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                        {(t.shareUrl || t.mediaUrl) && (
                          <a href={t.shareUrl ?? t.mediaUrl} target="_blank" rel="noopener noreferrer"
                            className={`${BTN_SM} bg-white border border-gray-200 text-gray-600 hover:border-gray-300`}>
                            Watch / Listen ↗
                          </a>
                        )}
                        {isAssigned || existingAssignment ? (
                          <>
                            <button
                              onClick={() => openAssign(t, existingAssignment?.questionId)}
                              className={`${BTN_SM} ${isAssigned ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'} text-white`}>
                              Edit assignment →
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Remove this assignment?')) {
                                  removeAssignment(t.shareUrl ?? t.mediaUrl, t.id);
                                }
                              }}
                              className={`${BTN_SM} bg-white border border-red-200 text-red-500 hover:bg-red-50`}>
                              Remove
                            </button>
                          </>
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
                    size={8}
                  >
                    <option value="">— Pick a question —</option>
                    {(() => {
                      const needsGroup = allQuestions.filter(q => q.missingEn || q.missingEs);
                      const stockedGroup = allQuestions.filter(q => !q.missingEn && !q.missingEs);
                      const byA = (list: NeedsSample[]) =>
                        list.reduce<Record<string, NeedsSample[]>>((acc, q) => {
                          (acc[q.assessmentTitle] ??= []).push(q);
                          return acc;
                        }, {});
                      const label = (q: NeedsSample) => {
                        const needs = q.missingEn && q.missingEs ? ' (needs EN+ES)' : q.missingEn ? ' (needs EN)' : q.missingEs ? ' (needs ES)' : '';
                        const wording = q.questionText ? ` — ${q.questionText}` : '';
                        return `${q.questionTitle}${needs}${wording}`;
                      };
                      return (
                        <>
                          {Object.entries(byA(needsGroup)).map(([aTitle, qs]) => (
                            <optgroup key={`needs-${aTitle}`} label={aTitle}>
                              {qs.map(q => <option key={q.questionId} value={q.questionId}>{label(q)}</option>)}
                            </optgroup>
                          ))}
                          {stockedGroup.length > 0 && <>
                            <option disabled>────── Already have samples ──────</option>
                            {Object.entries(byA(stockedGroup)).map(([aTitle, qs]) => (
                              <optgroup key={`stocked-${aTitle}`} label={aTitle}>
                                {qs.map(q => <option key={q.questionId} value={q.questionId}>{label(q)}</option>)}
                              </optgroup>
                            ))}
                          </>}
                        </>
                      );
                    })()}
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

                {/* Warning: existing featured sample will be replaced */}
                {(() => {
                  const q = allQuestions.find(q => q.questionId === assign.questionId);
                  const existing = assign.language === 'english' ? q?.featuredEn : q?.featuredEs;
                  if (!existing) return null;
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1L1 14h14L8 1zm0 3l4.5 8.5h-9L8 4zm0 3v3m0 1.5v1"/>
                          <path d="M8 4l4.5 8.5h-9L8 4z" fill="none" stroke="currentColor" strokeWidth="1"/>
                          <rect x="7.25" y="7" width="1.5" height="3" rx=".5"/>
                          <circle cx="8" cy="11.5" r=".75"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-800">This will replace the current featured {assign.language} sample</p>
                          {existing.excerpt && (
                            <p className="text-xs text-amber-700 mt-1 italic leading-relaxed">&ldquo;{existing.excerpt.slice(0, 200)}{existing.excerpt.length > 200 ? '…' : ''}&rdquo;</p>
                          )}
                        </div>
                      </div>
                      {/* Preview of existing sample */}
                      <div>
                        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Currently featured — watch before replacing:</p>
                        {existing.mediaType === 'audio' ? (
                          <audio controls preload="none" src={existing.embedUrl} className="w-full" style={{ height: '36px' }} />
                        ) : (
                          <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                            <iframe
                              src={existing.embedUrl}
                              allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *;"
                              className="w-full h-full"
                              style={{ border: 'none' }}
                              title="Current featured sample"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

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
                      <option value="M">M</option>
                      <option value="F">F</option>
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
                    rows={8}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20 resize-y"
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
