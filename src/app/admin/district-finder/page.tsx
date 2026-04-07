'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────

interface Pilot {
  id: string;
  name: string;
  schools: string[];
  totalSubmissions: number;
}

interface District {
  name: string;
  pilots: Pilot[];
}

interface SidebarData {
  districts: District[];
}

interface FilterOptions {
  grades: string[];
  genders: string[];
  languages: string[];
  promptTitles: string[];
}

interface AnswerCard {
  id: string;
  responseId: string;
  promptTitle: string;
  promptIndex: number;
  mediaType: 'video' | 'audio';
  mediaUrl: string | null;
  shareUrl: string | null;
  thumbnailUrl: string | null;
  transcript: string;
  language: string | null;
  schoolName: string;
  gradeLevel: string | null;
  gender: string | null;
  pilotId: string;
  wordCount: number;
  createdAt: string;
}

interface SearchResponse {
  transcripts: AnswerCard[];
  totalCount: number;
  hasMore: boolean;
  filterOptions: FilterOptions;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function langLabel(code: string | null): string {
  if (!code) return '';
  if (code === 'en') return 'English';
  if (code === 'es') return 'Spanish';
  return code.toUpperCase();
}

function isDirectAudio(url: string): boolean {
  return /\.(mp3|ogg|m4a|wav|aac)(\?|$)/i.test(url);
}

function excerptText(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

// ── Page component ─────────────────────────────────────────────────────────

export default function DistrictFinderPage() {
  // Sidebar data
  const [sidebarData, setSidebarData]       = useState<SidebarData | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  const [expandedPilots, setExpandedPilots]       = useState<Set<string>>(new Set());

  // Selection state
  const [selectedPilotIds, setSelectedPilotIds] = useState<string[]>([]);
  const [selectedSchool, setSelectedSchool]     = useState<string>('');

  // Search / filter state
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [mediaType, setMediaType]     = useState<'video' | 'audio' | ''>('');
  const [minWords, setMinWords]       = useState(15);

  // Active filters (from filterOptions)
  const [selectedGrade, setSelectedGrade]         = useState('');
  const [selectedGender, setSelectedGender]       = useState('');
  const [selectedLanguage, setSelectedLanguage]   = useState('');
  const [selectedPromptTitle, setSelectedPromptTitle] = useState('');

  // Results state
  const [transcripts, setTranscripts]       = useState<AnswerCard[]>([]);
  const [totalCount, setTotalCount]         = useState<number | null>(null);
  const [hasMore, setHasMore]               = useState(false);
  const [filterOptions, setFilterOptions]   = useState<FilterOptions>({ grades: [], genders: [], languages: [], promptTitles: [] });
  const [loading, setLoading]               = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [fetchError, setFetchError]         = useState('');
  const [page, setPage]                     = useState(1);

  // Expanded transcripts
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ── Load sidebar ──────────────────────────────────────────────────────────

  useEffect(() => {
    setSidebarLoading(true);
    fetch('/api/admin/district-finder?mode=sidebar')
      .then(r => r.json())
      .then((d: SidebarData) => {
        setSidebarData(d);
        // Expand all districts by default
        const names = new Set((d.districts ?? []).map((dist: District) => dist.name));
        setExpandedDistricts(names);
        setSidebarLoading(false);
      })
      .catch(() => setSidebarLoading(false));
  }, []);

  // ── Fetch transcripts ─────────────────────────────────────────────────────

  const fetchTranscripts = useCallback(async (pg: number, replace: boolean) => {
    if (selectedPilotIds.length === 0) return;
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    setFetchError('');

    try {
      const params = new URLSearchParams({
        mode: 'search',
        pilotIds: selectedPilotIds.join(','),
        page: String(pg),
        minWords: String(minWords),
      });
      if (selectedSchool)       params.set('school', selectedSchool);
      if (selectedGrade)        params.set('grade', selectedGrade);
      if (selectedGender)       params.set('gender', selectedGender);
      if (selectedLanguage)     params.set('language', selectedLanguage);
      if (selectedPromptTitle)  params.set('promptTitle', selectedPromptTitle);
      if (mediaType)            params.set('mediaType', mediaType);
      if (search)               params.set('search', search);

      const res = await fetch(`/api/admin/district-finder?${params}`);
      const text = await res.text();
      let data: SearchResponse;
      try { data = JSON.parse(text); }
      catch { setFetchError(`Server returned (${res.status}): ${text.slice(0, 300)}`); setLoading(false); setLoadingMore(false); return; }

      if (!res.ok) { setFetchError(`Error ${res.status}: ${JSON.stringify(data)}`); setLoading(false); setLoadingMore(false); return; }

      setTranscripts(prev => replace ? data.transcripts : [...prev, ...data.transcripts]);
      setHasMore(data.hasMore ?? false);
      if (replace) {
        setTotalCount(data.totalCount ?? null);
        setFilterOptions(data.filterOptions ?? { grades: [], genders: [], languages: [], promptTitles: [] });
      }
    } catch (e) {
      setFetchError(`Network error: ${e}`);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [selectedPilotIds, selectedSchool, selectedGrade, selectedGender, selectedLanguage, selectedPromptTitle, mediaType, minWords, search]);

  // Re-fetch when dependencies change
  useEffect(() => {
    if (selectedPilotIds.length === 0) {
      setTranscripts([]);
      setTotalCount(null);
      setFilterOptions({ grades: [], genders: [], languages: [], promptTitles: [] });
      return;
    }
    setPage(1);
    setExpanded(new Set());
    fetchTranscripts(1, true);
  }, [fetchTranscripts, selectedPilotIds]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchTranscripts(next, false);
  }

  // Clear all filters (except pilot/school selection)
  function clearFilters() {
    setSelectedGrade('');
    setSelectedGender('');
    setSelectedLanguage('');
    setSelectedPromptTitle('');
    setSearch('');
    setSearchInput('');
    setMediaType('');
  }

  const hasActiveFilters = selectedGrade || selectedGender || selectedLanguage || selectedPromptTitle || search || mediaType;

  // ── Styles ────────────────────────────────────────────────────────────────

  const INPUT  = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2744]/20';
  const BTN_SM = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap flex-shrink-0">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</Link>
        <h1 className="text-base font-semibold text-gray-900">District Response Finder</h1>
        <div className="flex-1" />
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Min words</span>
            <select
              value={minWords}
              onChange={e => setMinWords(Number(e.target.value))}
              className={INPUT}
            >
              <option value={5}>5+</option>
              <option value={15}>15+</option>
              <option value={30}>30+</option>
              <option value={60}>60+</option>
              <option value={100}>100+</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            {(['', 'video', 'audio'] as const).map(t => (
              <button
                key={t}
                onClick={() => setMediaType(t)}
                className={`${BTN_SM} border ${mediaType === t ? 'bg-[#1a2744] text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {t === '' ? 'All' : t === 'video' ? 'Video' : 'Audio'}
              </button>
            ))}
          </div>
          <form
            onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
            className="flex gap-1"
          >
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search transcripts…"
              className={`${INPUT} w-44`}
            />
            <button type="submit" className={`${BTN_SM} bg-[#1a2744] text-white`}>Search</button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); }}
                className={`${BTN_SM} bg-white border border-gray-200 text-gray-500`}
              >
                ✕
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          {sidebarLoading ? (
            <div className="px-4 py-6 text-xs text-gray-400">Loading districts…</div>
          ) : !sidebarData || sidebarData.districts.length === 0 ? (
            <div className="px-4 py-6 text-xs text-gray-400">No districts found.</div>
          ) : (
            sidebarData.districts.map(district => {
              const isDistrictExpanded = expandedDistricts.has(district.name);
              const allDistrictPilotIds = district.pilots.map(p => p.id);
              const isDistrictSelected =
                selectedPilotIds.length === allDistrictPilotIds.length &&
                allDistrictPilotIds.every(id => selectedPilotIds.includes(id)) &&
                !selectedSchool;

              return (
                <div key={district.name} className="border-b border-gray-100 last:border-b-0">
                  {/* District header */}
                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        setSelectedPilotIds(allDistrictPilotIds);
                        setSelectedSchool('');
                      }}
                      className={`flex-1 text-left px-4 py-2.5 transition-colors ${
                        isDistrictSelected
                          ? 'bg-[#1a2744]/5 text-[#1a2744]'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wide leading-tight">{district.name}</span>
                    </button>
                    <button
                      onClick={() => setExpandedDistricts(s => {
                        const n = new Set(s);
                        n.has(district.name) ? n.delete(district.name) : n.add(district.name);
                        return n;
                      })}
                      className="px-3 py-2.5 text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
                    >
                      {isDistrictExpanded ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Pilots under district */}
                  {isDistrictExpanded && district.pilots.map(pilot => {
                    const isPilotSelected =
                      selectedPilotIds.length === 1 &&
                      selectedPilotIds[0] === pilot.id &&
                      !selectedSchool;
                    const isPilotExpanded = expandedPilots.has(pilot.id);

                    return (
                      <div key={pilot.id}>
                        {/* Pilot row */}
                        <div className="flex items-center pl-4">
                          <button
                            onClick={() => {
                              setSelectedPilotIds([pilot.id]);
                              setSelectedSchool('');
                            }}
                            className={`flex-1 text-left px-2 py-2 border-l-2 transition-colors ${
                              isPilotSelected
                                ? 'border-[#1a2744] bg-[#1a2744]/5 text-[#1a2744]'
                                : 'border-transparent hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <p className="text-xs font-medium leading-snug">{pilot.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pilot.totalSubmissions} submissions</p>
                          </button>
                          {pilot.schools.length > 0 && (
                            <button
                              onClick={() => setExpandedPilots(s => {
                                const n = new Set(s);
                                n.has(pilot.id) ? n.delete(pilot.id) : n.add(pilot.id);
                                return n;
                              })}
                              className="px-3 py-2 text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
                            >
                              {isPilotExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>

                        {/* Schools under pilot */}
                        {isPilotExpanded && pilot.schools.map(school => {
                          const isSchoolSelected =
                            selectedPilotIds.length === 1 &&
                            selectedPilotIds[0] === pilot.id &&
                            selectedSchool === school;

                          return (
                            <button
                              key={school}
                              onClick={() => {
                                setSelectedPilotIds([pilot.id]);
                                setSelectedSchool(school);
                              }}
                              className={`w-full text-left pl-10 pr-4 py-1.5 border-l-2 transition-colors ${
                                isSchoolSelected
                                  ? 'border-[#1a2744] bg-[#1a2744]/5 text-[#1a2744]'
                                  : 'border-transparent hover:bg-gray-50 text-gray-600'
                              }`}
                            >
                              <p className="text-xs leading-snug truncate">{school}</p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter chips row */}
          {selectedPilotIds.length > 0 && (
            <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-2 flex-wrap">
              {/* Grade chips */}
              {filterOptions.grades.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(prev => prev === g ? '' : g)}
                  className={`${BTN_SM} border text-xs ${selectedGrade === g ? 'bg-teal-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
                >
                  Grade {g}
                </button>
              ))}
              {/* Gender chips */}
              {filterOptions.genders.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGender(prev => prev === g ? '' : g)}
                  className={`${BTN_SM} border text-xs ${selectedGender === g ? 'bg-purple-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'}`}
                >
                  {g}
                </button>
              ))}
              {/* Language chips */}
              {filterOptions.languages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(prev => prev === lang ? '' : lang)}
                  className={`${BTN_SM} border text-xs ${selectedLanguage === lang ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                >
                  {langLabel(lang)}
                </button>
              ))}
              {/* Prompt title dropdown */}
              {filterOptions.promptTitles.length > 0 && (
                <select
                  value={selectedPromptTitle}
                  onChange={e => setSelectedPromptTitle(e.target.value)}
                  className={`${INPUT} text-xs max-w-xs`}
                >
                  <option value="">All prompts</option>
                  {filterOptions.promptTitles.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className={`${BTN_SM} bg-gray-100 text-gray-500 hover:bg-gray-200 ml-auto`}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Scrollable results */}
          <main className="flex-1 overflow-y-auto px-6 py-6">
            {selectedPilotIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl text-gray-400">←</div>
                <p className="text-gray-500 font-medium">Select a district, program, or school from the sidebar</p>
                <p className="text-gray-400 text-sm max-w-sm">Click a district name to see all responses, or drill down into a specific school.</p>
              </div>
            ) : fetchError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 font-mono whitespace-pre-wrap">{fetchError}</div>
            ) : loading ? (
              <div className="text-sm text-gray-400 py-10 text-center">Loading responses…</div>
            ) : transcripts.length === 0 ? (
              <div className="text-sm text-gray-400 py-10 text-center">No responses found. Try adjusting the filters or min word count.</div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  {totalCount !== null ? `${totalCount} total · ` : ''}{transcripts.length} shown
                  {selectedSchool && <span> · {selectedSchool}</span>}
                </p>

                <div className="space-y-4">
                  {transcripts.map(t => {
                    const isExpanded = expanded.has(t.id);
                    const pilotName = sidebarData?.districts
                      .flatMap(d => d.pilots)
                      .find(p => p.id === t.pilotId)?.name ?? '';

                    return (
                      <div
                        key={t.id}
                        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                      >
                        {/* Card header */}
                        <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
                          {t.promptTitle && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1a2744]/10 text-[#1a2744]">
                              {t.promptTitle}
                            </span>
                          )}
                          {t.mediaType === 'audio' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Audio</span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Video</span>
                          )}
                          {t.gradeLevel && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">Grade {t.gradeLevel}</span>
                          )}
                          {t.gender && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{t.gender}</span>
                          )}
                          {t.language && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{langLabel(t.language)}</span>
                          )}
                          <span className="text-xs text-gray-400">{t.wordCount} words</span>
                          {t.schoolName && (
                            <span className="text-xs text-gray-500 ml-auto truncate max-w-[200px]">{t.schoolName}</span>
                          )}
                          {pilotName && (
                            <span className="text-xs text-gray-400 truncate max-w-[180px]">{pilotName}</span>
                          )}
                        </div>

                        {/* Thumbnail (if available and no embed) */}
                        {t.thumbnailUrl && !t.shareUrl && (
                          <div className="px-5 pt-3 pb-1">
                            <img
                              src={t.thumbnailUrl}
                              alt="Response thumbnail"
                              className="rounded-xl w-32 h-auto object-cover"
                            />
                          </div>
                        )}

                        {/* Video embed via share_url */}
                        {t.shareUrl && t.mediaType === 'video' && (
                          <div className="px-5 pt-3 pb-1">
                            <div className="w-1/2 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                              <iframe
                                src={t.shareUrl}
                                allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *;"
                                className="w-full h-full"
                                style={{ border: 'none' }}
                                loading="lazy"
                                title={t.promptTitle || 'Video response'}
                              />
                            </div>
                          </div>
                        )}

                        {/* Audio player */}
                        {t.mediaType === 'audio' && t.shareUrl && isDirectAudio(t.shareUrl) && (
                          <div className="px-5 pt-3 pb-1">
                            <audio controls preload="none" src={t.shareUrl} className="w-full" style={{ height: '36px' }} />
                          </div>
                        )}
                        {t.mediaType === 'audio' && !t.shareUrl && t.mediaUrl && isDirectAudio(t.mediaUrl) && (
                          <div className="px-5 pt-3 pb-1">
                            <audio controls preload="none" src={t.mediaUrl} className="w-full" style={{ height: '36px' }} />
                          </div>
                        )}

                        {/* Transcript */}
                        <div className="px-5 py-3">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {isExpanded ? t.transcript : excerptText(t.transcript)}
                          </p>
                          {t.transcript.length > 200 && (
                            <button
                              onClick={() => setExpanded(s => {
                                const n = new Set(s);
                                n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                                return n;
                              })}
                              className="text-xs text-[#1a2744] underline mt-1"
                            >
                              {isExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-gray-400">{t.wordCount} words</span>
                          {t.shareUrl && (
                            <a
                              href={t.shareUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${BTN_SM} bg-white border border-gray-200 text-gray-600 hover:border-gray-300`}
                            >
                              Watch / Listen ↗
                            </a>
                          )}
                          {t.mediaUrl && (
                            <a
                              href={t.mediaUrl}
                              download
                              className={`${BTN_SM} bg-white border border-gray-200 text-gray-600 hover:border-gray-300`}
                              title={`Download ${t.mediaType === 'audio' ? 'audio' : 'video'}`}
                            >
                              ↓ Download
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-gray-300 shadow-sm transition-all disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
