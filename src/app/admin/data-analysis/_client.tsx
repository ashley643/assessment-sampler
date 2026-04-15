'use client';

import { useState, useCallback, useRef, type RefObject } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// ---- Types ----------------------------------------------------------------
type Row = Record<string, string>;

// ---- Color palette --------------------------------------------------------
const PALETTE = [
  '#3b6fce', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
  '#84cc16', '#ec4899',
];
function pickColor(i: number) { return PALETTE[i % PALETTE.length]; }

// ---- CSV parser -----------------------------------------------------------
function parseCSV(raw: string): { columns: string[]; rows: Row[] } {
  // Strip BOM
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { columns: [], rows: [] };

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const columns = splitLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = splitLine(l);
    const row: Row = {};
    columns.forEach((col, i) => { row[col] = vals[i] ?? ''; });
    return row;
  });
  return { columns, rows };
}

// ---- Aggregate helpers ----------------------------------------------------
function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key] || '(blank)';
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

function avgBy(
  rows: Row[], groupKey: string, valueKey: string,
): Record<string, { sum: number; count: number }> {
  const out: Record<string, { sum: number; count: number }> = {};
  for (const r of rows) {
    const g = r[groupKey] || '(blank)';
    const v = parseFloat(r[valueKey]);
    if (!isNaN(v)) {
      if (!out[g]) out[g] = { sum: 0, count: 0 };
      out[g].sum += v;
      out[g].count++;
    }
  }
  return out;
}

function distinctSorted(rows: Row[], key: string): string[] {
  const s = new Set<string>();
  for (const r of rows) if (r[key]) s.add(r[key]);
  return Array.from(s).sort();
}

// ---- Heatmap cell color ---------------------------------------------------
function heatColor(val: number, max: number): string {
  if (max === 0 || val === 0) return '#f9fafb';
  const t = Math.min(val / max, 1);
  const r = Math.round(224 + (30 - 224) * t);
  const g = Math.round(234 + (64 - 234) * t);
  const b = Math.round(255 + (175 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

// ---- Score type config ----------------------------------------------------
// Each entry can have multiple scoreCol options (e.g. raw vs impacter)
const SCORE_TYPES = [
  {
    id: 'csi', label: 'CSI', attrCol: 'csi_attribute',
    scoreOptions: [
      { col: 'community_schools_index_score', label: 'Raw' },
      { col: 'csi_adjusted',                  label: 'Adjusted' },
    ],
  },
  {
    id: 'harvard', label: 'Harvard', attrCol: 'harvard_attribute',
    scoreOptions: [
      { col: 'harvard_score',          label: 'Raw' },
      { col: 'harvard_impacter_score', label: 'Impacter' },
    ],
  },
  {
    id: 'casel', label: 'CASEL', attrCol: 'casel_attribute',
    scoreOptions: [
      { col: 'casel_score',          label: 'Raw' },
      { col: 'casel_impacter_score', label: 'Impacter' },
    ],
  },
] as const;
type ScoreTypeId = typeof SCORE_TYPES[number]['id'];

// ---- Friendly labels for known column names --------------------------------
const KNOWN_LABELS: Record<string, string> = {
  gender:         'Gender',
  current_grade:  'Grade',
  grade:          'Grade',
  home_language:  'Language',
  language:       'Language',
  response_type:  'Response Type',
  school_name:    'School',
  school:         'School',
  district_name:  'District',
  district:       'District',
  ethnicity:      'Ethnicity',
  hispanic:       'Hispanic',
  ell:            'ELL',
  frl:            'FRL',
  iep:            'IEP',
  class_name:     'Class',
  course_id:      'Course',
  session_name:   'Session',
  question_num:   'Question #',
};

// Columns to always exclude from demographic filters (PII, free-text, scores)
const EXCLUDE_FROM_DEMO = new Set([
  'id', 'first_name', 'last_name', 'student_email', 'email',
  'question', 'answer', 'url', 'answer_date',
  'community_schools_index_score', 'csi_adjusted',
  'harvard_score', 'harvard_impacter_score',
  'casel_score', 'casel_impacter_score',
  'csi_attribute', 'harvard_attribute', 'casel_attribute',
]);

// Auto-detect categorical demographic columns from whatever columns the CSV has
function detectDemoDims(columns: string[], rows: Row[]): { id: string; label: string }[] {
  return columns
    .filter(col => !EXCLUDE_FROM_DEMO.has(col))
    .map(col => {
      const vals = Array.from(new Set(rows.map(r => r[col]).filter(Boolean)));
      if (vals.length < 2 || vals.length > 25) return null;
      if (vals.some(v => v.length > 40)) return null;
      const label = KNOWN_LABELS[col.toLowerCase()]
        ?? col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { id: col, label };
    })
    .filter(Boolean) as { id: string; label: string }[];
}

// ---- CSV export helper ----------------------------------------------------
function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const cols = Object.keys(data[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = '\uFEFF' + [
    cols.join(','),
    ...data.map(r => cols.map(c => escape(r[c])).join(',')),
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
}

// ---- Chart image export ---------------------------------------------------
// Uses the browser's built-in html-to-canvas capability via foreignObject SVG.
// Falls back to a simpler approach: embed the element as an SVG foreignObject,
// draw to canvas, then download as PNG.
async function captureChart(ref: RefObject<HTMLDivElement | null>, filename: string) {
  const el = ref.current;
  if (!el) return;
  const { default: html2canvas } = await import('html2canvas').catch(() => ({ default: null }));
  if (!html2canvas) {
    // Fallback: serialize to SVG via foreignObject
    const { width, height } = el.getBoundingClientRect();
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.background = '#ffffff';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${clone.outerHTML}</div>
      </foreignObject>
    </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace('.png', '.svg');
    a.click();
    return;
  }
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}

// ---- Shared button styles -------------------------------------------------
const chipBase: React.CSSProperties = {
  fontSize: 11, padding: '4px 12px', borderRadius: 20,
  cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
};
const exportBtn: React.CSSProperties = {
  fontSize: 11, color: '#3b6fce', background: '#eff6ff',
  border: '1px solid #bfdbfe', borderRadius: 6,
  padding: '5px 12px', cursor: 'pointer',
};

// ==========================================================================
//  Main component
// ==========================================================================
export default function DataAnalysisClient() {
  const [columns, setColumns]       = useState<string[]>([]);
  const [allRows, setAllRows]       = useState<Row[]>([]);
  const [dragging, setDragging]     = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);
  // Chart refs for image export
  const refParticip                 = useRef<HTMLDivElement>(null);
  const refHeatmap                  = useRef<HTMLDivElement>(null);
  const refPerfAttrs                = useRef<HTMLDivElement>(null);
  const refPerfBreakdown            = useRef<HTMLDivElement>(null);
  const refPerfSchool               = useRef<HTMLDivElement>(null);

  // Filters: column → Set of selected values
  const [filters, setFilters]       = useState<Record<string, Set<string>>>({});

  // UI state
  const [tab, setTab]               = useState<'participation' | 'performance'>('participation');
  const [participDim, setParticipDim] = useState('');
  const [scoreType, setScoreType]   = useState<ScoreTypeId>('csi');
  // scoreCol: which score column variant to use per score type
  const [scoreCols, setScoreCols]   = useState<Record<string, string>>({});
  const [perfDim, setPerfDim]       = useState('');
  const [selectedAttr, setSelectedAttr] = useState<string | null>(null);

  // ---- Load CSV -----------------------------------------------------------
  const loadText = useCallback((text: string) => {
    const { columns, rows } = parseCSV(text);
    setColumns(columns);
    setAllRows(rows);
    setFilters({});
    setSelectedAttr(null);
    // Auto-select first available score type + default score column variant
    const defaultScoreCols: Record<string, string> = {};
    for (const st of SCORE_TYPES) {
      for (const opt of st.scoreOptions) {
        if (columns.includes(opt.col) && !defaultScoreCols[st.id]) {
          defaultScoreCols[st.id] = opt.col;
        }
      }
    }
    setScoreCols(defaultScoreCols);
    for (const st of SCORE_TYPES) {
      if (columns.includes(st.attrCol)) { setScoreType(st.id); break; }
    }
    // Auto-select first categorical demographic column
    const detected = detectDemoDims(columns, rows);
    if (detected.length > 0) {
      setParticipDim(detected[0].id);
      setPerfDim(detected[0].id);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => loadText((e.target?.result as string) ?? '');
    reader.readAsText(file, 'utf-8');
  }, [loadText]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ---- Filtered rows ------------------------------------------------------
  const filteredRows = allRows.filter(row =>
    Object.entries(filters).every(([col, vals]) =>
      vals.size === 0 || vals.has(row[col]),
    ),
  );

  const toggleFilter = (col: string, val: string) => {
    setFilters(prev => {
      const s = new Set(prev[col] ?? []);
      if (s.has(val)) s.delete(val); else s.add(val);
      return { ...prev, [col]: s };
    });
  };

  // ---- Active demographic dims (auto-detected from actual columns) --------
  const activeDemoDims = detectDemoDims(columns, allRows);

  // ---- Import screen ------------------------------------------------------
  if (allRows.length === 0) {
    return (
      <AdminShell>
        <div style={{ maxWidth: 560, margin: '60px auto 0', fontFamily: 'DM Sans, sans-serif' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Data Analysis</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
            Import a CSV to generate participation and performance charts with demographic breakdowns.
          </p>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#3b6fce' : '#d1d5db'}`,
              borderRadius: 16, padding: '52px 32px', textAlign: 'center',
              cursor: 'pointer', background: dragging ? '#eff6ff' : '#fafafa',
              transition: 'all 0.2s',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 14px' }}>
              <rect x="3" y="3" width="18" height="18" rx="3" fill={dragging ? '#3b6fce' : '#e5e7eb'} />
              <path d="M9 12h6M12 9v6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
              {dragging ? 'Drop to import' : 'Drop your CSV here, or click to browse'}
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Supports up to ~50k rows</p>
          </div>
          <input
            ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div style={{ marginTop: 24, padding: '14px 18px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Expected columns</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.7 }}>
              id, district_name, school_name, gender, current_grade, home_language, response_type,
              csi_attribute, community_schools_index_score, harvard_attribute, harvard_score,
              casel_attribute, casel_score
            </p>
          </div>
        </div>
      </AdminShell>
    );
  }

  // ---- Derived data -------------------------------------------------------
  const stCfg      = SCORE_TYPES.find(s => s.id === scoreType)!;
  // Active score column (user-selected variant, or first available)
  const activeScoreCol = scoreCols[scoreType]
    ?? stCfg.scoreOptions.find(o => columns.includes(o.col))?.col
    ?? stCfg.scoreOptions[0].col;
  const availableScoreOpts = stCfg.scoreOptions.filter(o => columns.includes(o.col));

  const scoreAttrs  = distinctSorted(filteredRows, stCfg.attrCol);
  const activeAttr  = selectedAttr && scoreAttrs.includes(selectedAttr) ? selectedAttr : null;

  // Participation
  const participCounts = participDim ? countBy(filteredRows, participDim) : {};
  const participSorted = Object.entries(participCounts).sort((a, b) => b[1] - a[1]);
  const participMax    = Math.max(...participSorted.map(x => x[1]), 1);

  // Detect school column name dynamically (school_name or school)
  const schoolCol = columns.includes('school_name') ? 'school_name'
                  : columns.includes('school') ? 'school' : '';

  // Heatmap: school × participDim
  const schools  = schoolCol ? distinctSorted(filteredRows, schoolCol).slice(0, 25) : [];
  const dimVals  = participSorted.map(([v]) => v);
  const heatMax  = schools.length > 0 && participDim ? Math.max(
    ...schools.flatMap(sc =>
      dimVals.map(dv =>
        filteredRows.filter(r => r[schoolCol] === sc && r[participDim] === dv).length,
      ),
    ), 1,
  ) : 1;

  // Performance: attribute averages
  const attrAvgs = avgBy(filteredRows, stCfg.attrCol, activeScoreCol);
  const attrSorted = Object.entries(attrAvgs)
    .map(([attr, { sum, count }]) => ({ attr, avg: sum / count, count }))
    .sort((a, b) => b.avg - a.avg);

  // Breakdown: selected attribute × perfDim
  const breakdownData = (activeAttr && perfDim)
    ? Object.entries(avgBy(
        filteredRows.filter(r => r[stCfg.attrCol] === activeAttr),
        perfDim,
        activeScoreCol,
      ))
        .map(([label, { sum, count }]) => ({ label, avg: sum / count, count }))
        .sort((a, b) => b.avg - a.avg)
    : [];

  const districtCol       = columns.includes('district_name') ? 'district_name'
                          : columns.includes('district') ? 'district' : '';
  const distinctDistricts = districtCol ? distinctSorted(allRows, districtCol).length : 0;
  const distinctSchools   = schoolCol ? distinctSorted(allRows, schoolCol).length : 0;
  const hasFilters        = Object.values(filters).some(s => s.size > 0);

  // ---- Chart helpers for performance bars ---------------------------------
  // Use 100 as axis max for score bars (0-100 scale)
  const SCORE_MAX = 100;

  // =========================================================================
  return (
    <AdminShell>
      <div style={{ fontFamily: 'DM Sans, sans-serif', maxWidth: 960 }}>

        {/* ---- Header ---------------------------------------------------- */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Data Analysis</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: '4px 0 0' }}>
              {filteredRows.length.toLocaleString()}
              {hasFilters ? ` of ${allRows.length.toLocaleString()}` : ''} response{filteredRows.length !== 1 ? 's' : ''}
              {distinctSchools > 0 && ` · ${distinctSchools} school${distinctSchools !== 1 ? 's' : ''}`}
              {distinctDistricts > 0 && ` · ${distinctDistricts} district${distinctDistricts !== 1 ? 's' : ''}`}
              {columns.length > 0 && ` · ${columns.length} columns`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setAllRows([]); setColumns([]); setFilters({}); }}
              style={{ fontSize: 12, color: '#6b7280', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              New Import
            </button>
            <button
              onClick={() => exportCSV(filteredRows, 'filtered-data.csv')}
              style={{ fontSize: 12, color: 'white', background: '#3b6fce', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
            >
              Export All Data
            </button>
          </div>
        </div>

        {/* ---- Filters --------------------------------------------------- */}
        {activeDemoDims.length > 0 && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Filter</span>
              {hasFilters && (
                <button
                  onClick={() => setFilters({})}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear all
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {activeDemoDims.map(dim => {
                const vals = distinctSorted(allRows, dim.id);
                const selected = filters[dim.id] ?? new Set<string>();
                return (
                  <div key={dim.id}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{dim.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {vals.map(v => {
                        const on = selected.has(v);
                        return (
                          <button key={v} onClick={() => toggleFilter(dim.id, v)} style={{
                            ...chipBase,
                            border: on ? '1.5px solid #3b6fce' : '1.5px solid #e5e7eb',
                            background: on ? '#eff6ff' : 'white',
                            color: on ? '#3b6fce' : '#374151',
                          }}>
                            {v || '(blank)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Tab switcher ---------------------------------------------- */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 3, width: 'fit-content' }}>
          {(['participation', 'performance'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: 13, fontWeight: 600, padding: '7px 22px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? '#111827' : '#6b7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ================================================================
            PARTICIPATION TAB
        ================================================================ */}
        {tab === 'participation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Summary cards */}
            {(() => {
              const cards = [
                { label: 'Total Responses', value: filteredRows.length.toLocaleString() },
                ...(schoolCol   ? [{ label: 'Schools',   value: distinctSorted(filteredRows, schoolCol).length.toString() }]   : []),
                ...(districtCol ? [{ label: 'Districts', value: distinctSorted(filteredRows, districtCol).length.toString() }] : []),
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {cards.map(c => (
                    <div key={c.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#111827' }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Participation breakdown chart */}
            <div ref={refParticip} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Response Count by Dimension</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>How many responses per group</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {activeDemoDims
                    .filter(d => d.id !== schoolCol && d.id !== districtCol)
                    .map(d => (
                      <button key={d.id} onClick={() => setParticipDim(d.id)} style={{
                        ...chipBase,
                        border: participDim === d.id ? '1.5px solid #3b6fce' : '1.5px solid #e5e7eb',
                        background: participDim === d.id ? '#3b6fce' : 'white',
                        color: participDim === d.id ? 'white' : '#374151',
                      }}>
                        {d.label}
                      </button>
                    ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {participSorted.map(([val, cnt], i) => (
                  <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 148, fontSize: 12, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>{val}</div>
                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 22 }}>
                      <div style={{ width: `${(cnt / participMax) * 100}%`, height: '100%', background: pickColor(i), borderRadius: 4, transition: 'width 0.3s', minWidth: cnt > 0 ? 4 : 0 }} />
                    </div>
                    <div style={{ width: 40, fontSize: 12, color: '#6b7280', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{cnt.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => exportCSV(
                    participSorted.map(([val, cnt]) => ({ [participDim]: val, count: cnt })),
                    `participation-by-${participDim}.csv`,
                  )}
                  style={exportBtn}
                >
                  Download CSV
                </button>
                <button onClick={() => captureChart(refParticip, `participation-by-${participDim}.png`)} style={exportBtn}>
                  Download image
                </button>
              </div>
            </div>

            {/* Heatmap: school × dimension */}
            {schoolCol && schools.length > 0 && dimVals.length > 0 && participDim !== schoolCol && participDim !== districtCol && (
              <div ref={refHeatmap} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', overflowX: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                  School × {activeDemoDims.find(d => d.id === participDim)?.label ?? participDim} Heatmap
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Cell color intensity = response count</div>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '4px 10px 8px 4px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>School</th>
                      {dimVals.map(dv => (
                        <th key={dv} style={{ padding: '4px 6px 8px', textAlign: 'center', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{dv}</th>
                      ))}
                      <th style={{ padding: '4px 6px 8px', textAlign: 'center', color: '#374151', fontWeight: 700 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map(sc => {
                      const rowTotal = filteredRows.filter(r => r[schoolCol] === sc).length;
                      return (
                        <tr key={sc} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '5px 10px 5px 4px', color: '#374151', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={sc}>{sc}</td>
                          {dimVals.map(dv => {
                            const cnt = filteredRows.filter(r => r[schoolCol] === sc && r[participDim] === dv).length;
                            return (
                              <td key={dv} style={{
                                padding: '5px 6px', textAlign: 'center',
                                background: heatColor(cnt, heatMax),
                                color: cnt > heatMax * 0.55 ? 'white' : '#374151',
                                fontWeight: cnt > 0 ? 600 : 400,
                                fontSize: 11,
                              }}>
                                {cnt > 0 ? cnt : ''}
                              </td>
                            );
                          })}
                          <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700, color: '#111827' }}>{rowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {schools.length === 25 && (
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>Showing first 25 schools — use filters to narrow.</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => {
                      const data = schools.map(sc => {
                        const obj: Record<string, unknown> = { school: sc };
                        dimVals.forEach(dv => {
                          obj[dv] = filteredRows.filter(r => r[schoolCol] === sc && r[participDim] === dv).length;
                        });
                        obj.total = filteredRows.filter(r => r[schoolCol] === sc).length;
                        return obj;
                      });
                      exportCSV(data, `heatmap-school-${participDim}.csv`);
                    }}
                    style={exportBtn}
                  >
                    Download CSV
                  </button>
                  <button onClick={() => captureChart(refHeatmap, `heatmap-school-${participDim}.png`)} style={exportBtn}>
                    Download image
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            PERFORMANCE TAB
        ================================================================ */}
        {tab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Score type selector + variant picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {SCORE_TYPES.filter(st => columns.includes(st.attrCol)).map(st => (
                  <button key={st.id} onClick={() => { setScoreType(st.id); setSelectedAttr(null); }} style={{
                    fontSize: 13, fontWeight: 600, padding: '8px 22px', borderRadius: 8, cursor: 'pointer',
                    border: scoreType === st.id ? '1.5px solid #3b6fce' : '1.5px solid #e5e7eb',
                    background: scoreType === st.id ? '#3b6fce' : 'white',
                    color: scoreType === st.id ? 'white' : '#374151',
                  }}>
                    {st.label}
                  </button>
                ))}
                {SCORE_TYPES.every(st => !columns.includes(st.attrCol)) && (
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>
                    No score columns detected (csi_attribute / harvard_attribute / casel_attribute not found).
                  </p>
                )}
              </div>
              {/* Score column variant (Raw vs Impacter vs Adjusted) */}
              {availableScoreOpts.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Score:</span>
                  {availableScoreOpts.map(opt => (
                    <button key={opt.col} onClick={() => setScoreCols(prev => ({ ...prev, [scoreType]: opt.col }))} style={{
                      ...chipBase, fontSize: 11, padding: '3px 10px',
                      border: activeScoreCol === opt.col ? '1.5px solid #6366f1' : '1.5px solid #e5e7eb',
                      background: activeScoreCol === opt.col ? '#eef2ff' : 'white',
                      color: activeScoreCol === opt.col ? '#4f46e5' : '#374151',
                    }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scores by attribute */}
            {attrSorted.length > 0 ? (
              <div ref={refPerfAttrs} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                      Average {SCORE_TYPES.find(s => s.id === scoreType)?.label} Score by Attribute
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Click an attribute to see demographic breakdown below</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => exportCSV(
                        attrSorted.map(d => ({ attribute: d.attr, avg_score: d.avg.toFixed(2), n: d.count })),
                        `${scoreType}-scores-by-attribute.csv`,
                      )}
                      style={exportBtn}
                    >
                      Download CSV
                    </button>
                    <button onClick={() => captureChart(refPerfAttrs, `${scoreType}-scores-by-attribute.png`)} style={exportBtn}>
                      Download image
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attrSorted.map((d, i) => {
                    const isActive = activeAttr === d.attr;
                    return (
                      <div
                        key={d.attr}
                        onClick={() => setSelectedAttr(prev => prev === d.attr ? null : d.attr)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          cursor: 'pointer', borderRadius: 8, padding: '4px 6px',
                          background: isActive ? '#f0f9ff' : 'transparent',
                          outline: isActive ? '1.5px solid #bae6fd' : 'none',
                        }}
                      >
                        <div style={{
                          width: 190, fontSize: 12, textAlign: 'right', flexShrink: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: isActive ? '#0369a1' : '#374151', fontWeight: isActive ? 700 : 400,
                        }} title={d.attr}>
                          {d.attr}
                        </div>
                        <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 24, position: 'relative', overflow: 'hidden' }}>
                          <div style={{
                            width: `${(d.avg / SCORE_MAX) * 100}%`, height: '100%',
                            background: isActive ? '#0ea5e9' : pickColor(i),
                            borderRadius: 4, transition: 'width 0.3s',
                          }} />
                          <span style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 11, color: '#6b7280', fontWeight: 700,
                          }}>
                            {d.avg.toFixed(1)}
                          </span>
                        </div>
                        <div style={{ width: 52, fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>n={d.count}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Overall average */}
                {(() => {
                  const total = attrSorted.reduce((s, d) => s + d.avg * d.count, 0);
                  const n     = attrSorted.reduce((s, d) => s + d.count, 0);
                  const overall = n > 0 ? total / n : 0;
                  return (
                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Overall average across all attributes</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{overall.toFixed(1)}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>/ {SCORE_MAX}</span>
                    </div>
                  );
                })()}
              </div>
            ) : columns.includes(stCfg.attrCol) ? (
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', color: '#9ca3af', fontSize: 13 }}>
                No numeric scores found in column &ldquo;{activeScoreCol}&rdquo;.
              </div>
            ) : null}

            {/* Demographic breakdown for selected attribute */}
            {activeAttr && (
              <div ref={refPerfBreakdown} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0369a1', marginBottom: 2 }}>"{activeAttr}"</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      Average {scoreType.toUpperCase()} score by demographic group
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {activeDemoDims
                      .filter(d => d.id !== schoolCol && d.id !== districtCol)
                      .map(d => (
                        <button key={d.id} onClick={() => setPerfDim(d.id)} style={{
                          ...chipBase,
                          border: perfDim === d.id ? '1.5px solid #0369a1' : '1.5px solid #e5e7eb',
                          background: perfDim === d.id ? '#0369a1' : 'white',
                          color: perfDim === d.id ? 'white' : '#374151',
                        }}>
                          {d.label}
                        </button>
                      ))}
                  </div>
                </div>

                {breakdownData.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>No data for this breakdown.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {breakdownData.map((d, i) => {
                      // Score gap annotation relative to highest
                      const topAvg = breakdownData[0]?.avg ?? 0;
                      const gap    = topAvg > 0 && i > 0 ? topAvg - d.avg : null;
                      return (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 148, fontSize: 12, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>{d.label}</div>
                          <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 24, position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                              width: `${(d.avg / SCORE_MAX) * 100}%`, height: '100%',
                              background: pickColor(i), borderRadius: 4, transition: 'width 0.3s',
                            }} />
                            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>
                              {d.avg.toFixed(1)}
                            </span>
                          </div>
                          <div style={{ width: 80, fontSize: 11, flexShrink: 0, display: 'flex', gap: 6 }}>
                            <span style={{ color: '#9ca3af' }}>n={d.count}</span>
                            {gap !== null && gap > 0.5 && (
                              <span style={{ color: '#ef4444', fontWeight: 700 }}>−{gap.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => exportCSV(
                      breakdownData.map(d => ({ [perfDim]: d.label, attribute: activeAttr, avg_score: d.avg.toFixed(2), n: d.count })),
                      `${scoreType}-${activeAttr.replace(/\s+/g, '_')}-by-${perfDim}.csv`,
                    )}
                    style={exportBtn}
                  >
                    Download CSV
                  </button>
                  <button onClick={() => captureChart(refPerfBreakdown, `${scoreType}-${activeAttr.replace(/\s+/g, '_')}-by-${perfDim}.png`)} style={exportBtn}>
                    Download image
                  </button>
                </div>
              </div>
            )}

            {/* School-level performance table for selected attribute */}
            {activeAttr && schoolCol && (() => {
              const schoolAvgs = Object.entries(
                avgBy(filteredRows.filter(r => r[stCfg.attrCol] === activeAttr), schoolCol, activeScoreCol),
              )
                .map(([school, { sum, count }]) => ({ school, avg: sum / count, count }))
                .sort((a, b) => b.avg - a.avg);
              if (schoolAvgs.length === 0) return null;
              const scMax = Math.max(...schoolAvgs.map(s => s.avg));
              return (
                <div ref={refPerfSchool} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>"{activeAttr}" — by School</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Average score per school (sorted highest → lowest)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {schoolAvgs.map((s, i) => (
                      <div key={s.school} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 190, fontSize: 11, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.school}>{s.school}</div>
                        <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 18, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: `${(s.avg / scMax) * 100}%`, height: '100%', background: '#3b6fce', opacity: 0.55 + 0.45 * (s.avg / scMax), borderRadius: 4 }} />
                          <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#6b7280', fontWeight: 700 }}>{s.avg.toFixed(1)}</span>
                        </div>
                        <div style={{ width: 44, fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>n={s.count}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button
                      onClick={() => exportCSV(
                        schoolAvgs.map(s => ({ school: s.school, attribute: activeAttr, avg_score: s.avg.toFixed(2), n: s.count })),
                        `${scoreType}-${activeAttr.replace(/\s+/g, '_')}-by-school.csv`,
                      )}
                      style={exportBtn}
                    >
                      Download CSV
                    </button>
                    <button onClick={() => captureChart(refPerfSchool, `${scoreType}-${activeAttr.replace(/\s+/g, '_')}-by-school.png`)} style={exportBtn}>
                      Download image
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </AdminShell>
  );
}
