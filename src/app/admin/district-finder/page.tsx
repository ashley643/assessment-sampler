'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface District { name: string; schools: string[] }

interface FilterOptions {
  grades: string[];
  genders: string[];
  ethnicities: string[];
  homeLangs: string[];
  sessions: string[];
  courses: string[];
  attributes: string[];
  hispanicVaries: boolean;
  ellVaries: boolean;
  frlVaries: boolean;
  iepVaries: boolean;
}

interface SRRow {
  id: number;
  district_name: string;
  school_name: string;
  class_name: string | null;
  current_grade: number | null;
  gender: string | null;
  ethnicity: string | null;
  home_language: string | null;
  hispanic: boolean | null;
  ell: boolean | null;
  frl: boolean | null;
  iep: boolean | null;
  session_name: string | null;
  course_id: string | null;
  response_type: string | null;
  question: string | null;
  answer: string | null;
  harvard_attribute: string | null;
  harvard_score: number | null;
  casel_attribute: string | null;
  casel_score: number | null;
  url: string;
  shareUrl: string | null;
  answer_date: string | null;
}

const EMPTY_OPTS: FilterOptions = {
  grades: [], genders: [], ethnicities: [], homeLangs: [],
  sessions: [], courses: [], attributes: [],
  hispanicVaries: false, ellVaries: false, frlVaries: false, iepVaries: false,
};

// ── Small helpers ──────────────────────────────────────────────────────────
function attrLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function Dropdown({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[100px]">
        <option value="">All</option>
        {options.map(o => (
          <option key={o} value={o}>
            {label === 'Grade' ? `Grade ${o}` : label === 'Competency' ? attrLabel(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}

function BoolFilter({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        {(['', 'true', 'false'] as const).map(v => (
          <button key={v} onClick={() => onChange(v)}
            className={`text-xs px-2 py-1.5 transition-colors ${value === v ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {v === '' ? 'Any' : v === 'true' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Media card ─────────────────────────────────────────────────────────────
function MediaCard({ row }: { row: SRRow }) {
  const [expanded, setExpanded] = useState(false);
  const transcript = (row.answer ?? '').replace(/^"|"$/g, '').trim();
  const isLong = transcript.length > 300;
  const isAudio = row.response_type === 'audio' || /\.(mp3|ogg|m4a|aac)(\?|$)/i.test(row.url);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-blue-700 leading-snug flex-1">
            {row.question ?? (isAudio ? 'Audio response' : 'Video response')}
          </p>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
            isAudio ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>{isAudio ? 'Audio' : 'Video'}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {row.current_grade != null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">
              Grade {row.current_grade}
            </span>
          )}
          {row.gender && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
              {row.gender}
            </span>
          )}
          {row.harvard_attribute && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
              {attrLabel(row.harvard_attribute)}
              {row.harvard_score != null ? ` · ${row.harvard_score}` : ''}
            </span>
          )}
          {row.casel_attribute && row.casel_attribute !== row.harvard_attribute && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {attrLabel(row.casel_attribute)}
              {row.casel_score != null ? ` · ${row.casel_score}` : ''}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">{row.answer_date ?? ''}</span>
        </div>
      </div>

      {/* Player */}
      {row.shareUrl && !isAudio ? (
        <div className="px-4 pb-1">
          <iframe src={row.shareUrl}
            allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *"
            className="w-full aspect-video rounded-lg border border-gray-100"
            style={{ border: 'none' }} loading="lazy" title={row.question ?? 'Video'} />
        </div>
      ) : isAudio ? (
        <div className="px-4 pb-1">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls preload="none" src={row.shareUrl ?? row.url} className="w-full" />
        </div>
      ) : (
        <div className="px-4 pb-1">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="none" src={row.url} className="w-full aspect-video bg-black rounded-lg" />
        </div>
      )}

      {/* Transcript */}
      <div className="px-4 py-3">
        <p className={`text-sm text-gray-700 leading-relaxed ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
          {transcript}
        </p>
        {isLong && (
          <button onClick={() => setExpanded(v => !v)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <span className="truncate max-w-[200px]">{row.school_name}</span>
        {row.class_name && <span className="truncate max-w-[160px]">{row.class_name.split(',')[0].trim()}</span>}
        <div className="ml-auto flex items-center gap-2">
          {row.shareUrl && <a href={row.shareUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Share ↗</a>}
          <a href={row.url} download className="text-gray-400 hover:text-gray-600">↓ Download</a>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DistrictFinderPage() {
  const [districts, setDistricts]           = useState<District[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [needsSync, setNeedsSync]           = useState(false);
  const [notSetUp, setNotSetUp]             = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncResult, setSyncResult]         = useState<{ added: number; total: number; totalScanned?: number; districtsFound?: string[] } | null>(null);
  const [openDistricts, setOpenDistricts]   = useState<Set<string>>(new Set());

  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSchool, setSelectedSchool]     = useState('');

  // Filters
  const [grade, setGrade]         = useState('');
  const [gender, setGender]       = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [homeLang, setHomeLang]   = useState('');
  const [hispanic, setHispanic]   = useState('');
  const [ell, setEll]             = useState('');
  const [frl, setFrl]             = useState('');
  const [iep, setIep]             = useState('');
  const [session, setSession]     = useState('');
  const [course, setCourse]       = useState('');
  const [attribute, setAttribute] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [minScore, setMinScore]   = useState(0);
  const [minWords, setMinWords]   = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Results
  const [rows, setRows]                   = useState<SRRow[]>([]);
  const [totalCount, setTotalCount]       = useState<number | null>(null);
  const [hasMore, setHasMore]             = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_OPTS);
  const [loading, setLoading]             = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [fetchError, setFetchError]       = useState('');
  const [page, setPage]                   = useState(1);

  function loadSidebar() {
    setSidebarLoading(true);
    fetch('/api/admin/district-index')
      .then(r => r.json())
      .then(d => {
        setDistricts(d.districts ?? []);
        setNeedsSync(d.needsSync ?? false);
        setNotSetUp(d.notSetUp ?? false);
        setSidebarLoading(false);
      })
      .catch(() => setSidebarLoading(false));
  }

  useEffect(() => { loadSidebar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res  = await fetch('/api/admin/district-index/sync', { method: 'POST' });
      const data = await res.json();
      if (data.error) { alert(`Sync error: ${data.error}`); }
      else {
        setSyncResult({ added: data.added, total: data.total });
        loadSidebar();  // reload sidebar with new data
      }
    } catch (e) { alert(`Sync failed: ${e}`); }
    setSyncing(false);
  }

  const fetchRows = useCallback(async (pg: number, replace: boolean) => {
    if (!selectedDistrict) return;
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    setFetchError('');

    const p = new URLSearchParams({ mode: 'search', district: selectedDistrict, page: String(pg) });
    if (selectedSchool) p.set('school', selectedSchool);
    if (grade)     p.set('grade', grade);
    if (gender)    p.set('gender', gender);
    if (ethnicity) p.set('ethnicity', ethnicity);
    if (homeLang)  p.set('homeLang', homeLang);
    if (hispanic)  p.set('hispanic', hispanic);
    if (ell)       p.set('ell', ell);
    if (frl)       p.set('frl', frl);
    if (iep)       p.set('iep', iep);
    if (session)   p.set('session', session);
    if (course)    p.set('course', course);
    if (attribute) p.set('attribute', attribute);
    if (mediaType) p.set('mediaType', mediaType);
    if (minScore)  p.set('minScore', String(minScore));
    if (minWords)  p.set('minWords', String(minWords));
    if (search)    p.set('search', search);

    try {
      const res  = await fetch(`/api/admin/district-finder?${p}`);
      const data = await res.json();
      if (!res.ok || data.error) { setFetchError(data.error ?? `Error ${res.status}`); setLoading(false); setLoadingMore(false); return; }
      setRows(prev => replace ? data.rows : [...prev, ...data.rows]);
      setHasMore(data.hasMore ?? false);
      if (replace) {
        setTotalCount(data.totalCount ?? null);
        setFilterOptions(data.filterOptions ?? EMPTY_OPTS);
      }
    } catch (e) { setFetchError(`Network error: ${e}`); }
    setLoading(false);
    setLoadingMore(false);
  }, [selectedDistrict, selectedSchool, grade, gender, ethnicity, homeLang, hispanic, ell, frl, iep, session, course, attribute, mediaType, minScore, minWords, search]);

  useEffect(() => {
    if (!selectedDistrict) { setRows([]); setTotalCount(null); setFilterOptions(EMPTY_OPTS); return; }
    setPage(1);
    fetchRows(1, true);
  }, [fetchRows, selectedDistrict]);

  function loadMore() { const next = page + 1; setPage(next); fetchRows(next, false); }

  function clearFilters() {
    setGrade(''); setGender(''); setEthnicity(''); setHomeLang('');
    setHispanic(''); setEll(''); setFrl(''); setIep('');
    setSession(''); setCourse(''); setAttribute(''); setMediaType('');
    setMinScore(0); setMinWords(0); setSearch(''); setSearchInput('');
  }

  function pickDistrict(name: string) {
    setSelectedDistrict(name); setSelectedSchool(''); clearFilters();
    setOpenDistricts(prev => { const n = new Set(prev); n.add(name); return n; });
  }
  function pickSchool(district: string, school: string) {
    setSelectedDistrict(district); setSelectedSchool(school); clearFilters();
  }

  const activeFilterCount = [grade, gender, ethnicity, homeLang, hispanic, ell, frl, iep, session, course, attribute, mediaType, search].filter(Boolean).length
    + (minScore > 0 ? 1 : 0) + (minWords > 0 ? 1 : 0);

  const showBoolFilters = filterOptions.hispanicVaries || filterOptions.ellVaries || filterOptions.frlVaries || filterOptions.iepVaries;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <h1 className="text-sm font-semibold text-gray-900 whitespace-nowrap">District Response Finder</h1>

        {selectedDistrict && (
          <>
            {/* Filters button */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeFilterCount > 0 ? 'bg-gray-800 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            {/* Search */}
            <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-1">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Search questions & transcripts…"
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700">Go</button>
              {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">✕</button>}
            </form>

            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedDistrict && totalCount != null && (
            <span className="text-xs text-gray-400 whitespace-nowrap">{totalCount.toLocaleString()} responses</span>
          )}

          {/* Export CSV */}
          {selectedDistrict && (
            <a
              href={`/api/admin/district-finder?mode=export&district=${encodeURIComponent(selectedDistrict)}${selectedSchool ? `&school=${encodeURIComponent(selectedSchool)}` : ''}`}
              download
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export CSV
            </a>
          )}

          {/* VideoAsk Import */}
          <a
            href="/admin/videoask-import"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l5 3-5 3V2z" fill="currentColor"/>
              <rect x="8" y="2" width="2" height="8" rx="0.5" fill="currentColor"/>
            </svg>
            VideoAsk Import
          </a>
        </div>
      </div>

      {/* Expandable filter panel */}
      {showFilters && selectedDistrict && (
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-4 space-y-4">

          {/* Row 1: Demographics */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Demographics</p>
            <div className="flex items-end gap-3 flex-wrap">
              <Dropdown label="Grade"         options={filterOptions.grades}      value={grade}      onChange={setGrade} />
              <Dropdown label="Gender"        options={filterOptions.genders}     value={gender}     onChange={setGender} />
              <Dropdown label="Ethnicity"     options={filterOptions.ethnicities} value={ethnicity}  onChange={setEthnicity} />
              <Dropdown label="Home Language" options={filterOptions.homeLangs}   value={homeLang}   onChange={setHomeLang} />
              {filterOptions.hispanicVaries && <BoolFilter label="Hispanic" value={hispanic} onChange={setHispanic} />}
              {filterOptions.ellVaries       && <BoolFilter label="ELL"      value={ell}      onChange={setEll} />}
              {filterOptions.frlVaries       && <BoolFilter label="FRL"      value={frl}      onChange={setFrl} />}
              {filterOptions.iepVaries       && <BoolFilter label="IEP"      value={iep}      onChange={setIep} />}
              {!showBoolFilters && filterOptions.ethnicities.length === 0 && filterOptions.homeLangs.length === 0 && (
                <span className="text-xs text-gray-400 italic">No additional demographic data available for this selection</span>
              )}
            </div>
          </div>

          {/* Row 2: Content */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Content</p>
            <div className="flex items-end gap-3 flex-wrap">
              <Dropdown label="Competency" options={filterOptions.attributes} value={attribute} onChange={setAttribute} />
              <Dropdown label="Course"     options={filterOptions.courses}    value={course}    onChange={setCourse} />
              <Dropdown label="Session"    options={filterOptions.sessions}   value={session}   onChange={setSession} />
            </div>
          </div>

          {/* Row 3: Media & Quality */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Media & Quality</p>
            <div className="flex items-end gap-4 flex-wrap">

              {/* Media type */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Type</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['', 'video', 'audio'] as const).map(t => (
                    <button key={t} onClick={() => setMediaType(t)}
                      className={`text-xs px-2.5 py-1.5 transition-colors ${mediaType === t ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {t === '' ? 'All' : t === 'video' ? 'Video' : 'Audio'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min words */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Min words</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {[0, 15, 40, 80, 150].map(w => (
                    <button key={w} onClick={() => setMinWords(w)}
                      className={`text-xs px-2.5 py-1.5 transition-colors ${minWords === w ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {w === 0 ? 'Any' : `${w}+`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min score */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Min score</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {[0, 1, 2, 3, 4].map(s => (
                    <button key={s} onClick={() => setMinScore(s)}
                      className={`text-xs px-2.5 py-1.5 transition-colors ${minScore === s ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {s === 0 ? 'Any' : `${s}+`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Districts</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidebarLoading ? (
              <p className="px-4 py-4 text-xs text-gray-400">Loading…</p>
            ) : notSetUp ? (
              <div className="px-4 py-4 space-y-2">
                <p className="text-xs text-amber-700 font-medium">Table not set up yet.</p>
                <p className="text-xs text-gray-500">Run the SQL in <code className="bg-gray-100 px-1 rounded">supabase/migrations/20260407_district_school_index.sql</code> in your Supabase SQL editor, then sync.</p>
              </div>
            ) : needsSync ? (
              <p className="px-4 py-4 text-xs text-gray-400">No districts yet — sync to populate.</p>
            ) : districts.map(d => {
              const isDistrictSel = selectedDistrict === d.name && !selectedSchool;
              const isOpen = openDistricts.has(d.name);
              return (
                <div key={d.name} className="border-b border-gray-50 last:border-0">
                  <div className="flex items-stretch">
                    <button onClick={() => pickDistrict(d.name)}
                      className={`flex-1 text-left px-3 py-2 text-xs leading-snug transition-colors ${
                        isDistrictSel ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-gray-700 hover:bg-gray-50 font-medium'
                      }`}>
                      {d.name}
                    </button>
                    {d.schools.length > 0 && (
                      <button onClick={() => setOpenDistricts(prev => { const n = new Set(prev); n.has(d.name) ? n.delete(d.name) : n.add(d.name); return n; })}
                        className="px-2.5 text-gray-300 hover:text-gray-600 text-[10px]">
                        {isOpen ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                  {isOpen && d.schools.map(s => {
                    const isSchoolSel = selectedDistrict === d.name && selectedSchool === s;
                    return (
                      <button key={s} onClick={() => pickSchool(d.name, s)}
                        className={`w-full text-left pl-5 pr-3 py-1.5 text-xs transition-colors truncate border-l-2 ${
                          isSchoolSel ? 'bg-blue-50 text-blue-700 font-semibold border-blue-400' : 'text-gray-600 hover:bg-gray-50 border-transparent'
                        }`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Sync button at sidebar bottom */}
          <div className="flex-shrink-0 border-t border-gray-100 p-3 space-y-2">
            {syncResult && (
              <div className="text-xs space-y-1">
                <p className="text-green-600 font-medium">
                  {syncResult.added > 0 ? `Added ${syncResult.added} new entries` : 'No new entries found'}
                  {syncResult.totalScanned != null && ` · scanned ${syncResult.totalScanned.toLocaleString()} rows`}
                </p>
                {syncResult.districtsFound && syncResult.districtsFound.length > 0 && (
                  <details className="text-gray-500">
                    <summary className="cursor-pointer">{syncResult.districtsFound.length} district{syncResult.districtsFound.length !== 1 ? 's' : ''} found in data</summary>
                    <ul className="mt-1 space-y-0.5 pl-2">
                      {syncResult.districtsFound.map(d => <li key={d}>{d}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
            <button
              onClick={runSync}
              disabled={syncing || notSetUp}
              className="w-full text-xs px-3 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {syncing ? (
                <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Scanning…</>
              ) : (
                'Find new districts & schools'
              )}
            </button>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {!selectedDistrict ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400 mb-3">←</div>
              <p className="text-gray-500 font-medium">Select a district to browse media responses</p>
              <p className="text-gray-400 text-sm mt-1">Expand a district to filter by school</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-mono">{fetchError}</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="font-medium text-gray-500">No responses found</p>
              <p className="text-sm mt-1">Try adjusting filters</p>
            </div>
          ) : (
            <div className="p-5">
              <p className="text-xs text-gray-400 mb-4">
                <span className="font-medium text-gray-600">{selectedDistrict}</span>
                {selectedSchool && <> › <span>{selectedSchool}</span></>}
                <span className="ml-2">{totalCount?.toLocaleString()} total · {rows.length} shown</span>
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {rows.map(row => <MediaCard key={row.id} row={row} />)}
              </div>
              <div className="mt-6 flex justify-center">
                {loadingMore ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : hasMore ? (
                  <button onClick={loadMore} className="px-5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 shadow-sm">
                    Load more
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">All {totalCount?.toLocaleString()} responses shown</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
