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

// ---- Delimiter auto-detection & CSV/TSV parser ----------------------------
function detectDelimiter(firstLine: string): string {
  const candidates: [string, number][] = [
    ['\t', (firstLine.match(/\t/g)  ?? []).length],
    [',',  (firstLine.match(/,/g)   ?? []).length],
    [';',  (firstLine.match(/;/g)   ?? []).length],
    ['|',  (firstLine.match(/\|/g)  ?? []).length],
  ];
  return candidates.sort((a, b) => b[1] - a[1])[0][0];
}

function parseDelimited(raw: string): { columns: string[]; rows: Row[]; delimiter: string } {
  // Strip BOM
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  if (!text.trim()) return { columns: [], rows: [], delimiter: ',' };

  // Detect delimiter from the first non-empty line
  const firstLine = text.split(/\r?\n/).find(l => l.trim()) ?? '';
  const delimiter = detectDelimiter(firstLine);

  // TSV: simple line split (fields are not quoted; no multiline risk)
  if (delimiter === '\t') {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { columns: [], rows: [], delimiter: '\t' };
    const columns = lines[0].split('\t').map(s => s.trim());
    const rows = lines.slice(1).map(l => {
      const vals = l.split('\t').map(s => s.trim());
      const row: Row = {};
      columns.forEach((col, i) => { row[col] = vals[i] ?? ''; });
      return row;
    }).filter(r => Object.values(r).some(v => v));
    return { columns, rows, delimiter };
  }

  // CSV (comma / semicolon / pipe): full RFC 4180 character-by-character parse.
  // This correctly handles quoted fields that contain the delimiter OR newlines.
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }   // escaped quote
      else if (ch === '"')            { inQuote = false; }     // closing quote
      else                            { field += ch; }         // literal char (incl. \n)
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === delimiter) {
        record.push(field.trim()); field = '';
      } else if (ch === '\r' && next === '\n') {
        record.push(field.trim()); field = '';
        records.push(record); record = []; i++;
      } else if (ch === '\n') {
        record.push(field.trim()); field = '';
        records.push(record); record = [];
      } else {
        field += ch;
      }
    }
  }
  // Flush last field / record
  if (field || record.length > 0) {
    record.push(field.trim());
    if (record.some(f => f)) records.push(record);
  }

  if (records.length === 0) return { columns: [], rows: [], delimiter };
  const columns = records[0].map(c => c.trim());
  const rows = records.slice(1)
    .filter(r => r.some(f => f))
    .map(vals => {
      const row: Row = {};
      columns.forEach((col, i) => { row[col] = (vals[i] ?? '').trim(); });
      return row;
    });
  return { columns, rows, delimiter };
}

// Keep backward-compat alias used elsewhere in file
function parseCSV(raw: string) { return parseDelimited(raw); }

// ---- Blank / NA value detection -------------------------------------------
// Treats "NA", "N/A", "none", "null", "unknown" etc. as missing data so
// they are excluded from filter chips, charts, and heatmap dimensions.
function isBlankLike(v: string): boolean {
  return /^(na|n\/a|n\.a\.|none|null|unknown|-)$/i.test(v.trim());
}

// ---- Aggregate helpers ----------------------------------------------------
function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key];
    if (!v || isBlankLike(v)) continue;   // skip missing / NA-like values
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
  for (const r of rows) if (r[key] && !isBlankLike(r[key])) s.add(r[key]);
  return Array.from(s).sort();
}

// ---- Word count helpers ---------------------------------------------------
function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
function totalWordCount(rows: Row[], col: string): number {
  return rows.reduce((sum, r) => sum + (r[col] ? wordCount(r[col]) : 0), 0);
}

// ---- Heatmap cell color (participation counts) ----------------------------
function heatColor(val: number, max: number): string {
  if (max === 0) return 'rgb(238,242,255)';
  const t = val === 0 ? 0.04 : (0.12 + 0.88 * Math.min(val / max, 1));
  const r = Math.round(224 + (30  - 224) * t);
  const g = Math.round(234 + (64  - 234) * t);
  const b = Math.round(255 + (175 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

// ---- CSI score color (0–1 scale, white → green) ---------------------------
function csiColor(val: number | null): string {
  if (val === null) return '#f9fafb';
  const t = Math.max(0, Math.min(1, val));
  // white (#fff) → deep green (#166534)
  const r = Math.round(255 + (22  - 255) * t);
  const g = Math.round(255 + (101 - 255) * t);
  const b = Math.round(255 + (52  - 255) * t);
  return `rgb(${r},${g},${b})`;
}
function csiTextColor(val: number | null): string {
  return val !== null && val > 0.62 ? 'white' : '#374151';
}

// ---- Analysis modes -------------------------------------------------------
type AnalysisMode =
  | 'csi-pillar-school'
  | 'csi-pillar-grade'
  | 'csi-pillar-language';

const ANALYSIS_MODES: { id: AnalysisMode; label: string }[] = [
  { id: 'csi-pillar-school',   label: 'CSI × Pillar × School'   },
  { id: 'csi-pillar-grade',    label: 'CSI × Pillar × Grade'    },
  { id: 'csi-pillar-language', label: 'CSI × Pillar × Language' },
];

const PILLAR_COLORS = ['#3b6fce', '#14b8a6', '#8b5cf6', '#f59e0b'] as const;

// Auto-assign attributes to pillars 1–4 by detecting numeric prefix,
// then falling back to even distribution by sort order.
function autoAssignPillars(attrs: string[]): Record<string, number> {
  const sorted = [...attrs].sort();
  const result: Record<string, number> = {};
  // Try to detect a leading digit (1-4) in the attribute name
  let detected = 0;
  for (const a of sorted) {
    const m = a.match(/^([1-4])[\s_\-]/) ?? a.match(/\bpillar[\s_\-]?([1-4])\b/i);
    if (m) { result[a] = parseInt(m[1]); detected++; }
  }
  if (detected === sorted.length) return result;
  // Fall back: 4 equal groups in sort order
  const perGroup = Math.ceil(sorted.length / 4);
  sorted.forEach((a, i) => { result[a] = Math.min(Math.floor(i / perGroup) + 1, 4); });
  return result;
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
  'course_id', 'class_name', 'session_name', 'teacher_name',
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
      const vals = Array.from(new Set(rows.map(r => r[col]).filter(v => v && !isBlankLike(v))));
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
async function captureChart(ref: RefObject<HTMLDivElement | null>, filename: string) {
  const el = ref.current;
  if (!el) return;
  const { default: html2canvas } = await import('html2canvas').catch(() => ({ default: null }));
  if (!html2canvas) return;
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    // Capture the full element height, not just the visible viewport slice
    height: el.scrollHeight,
    windowHeight: el.scrollHeight,
    scrollX: 0,
    scrollY: 0,
    // Skip any element tagged data-no-capture (chips, export buttons)
    ignoreElements: (node: Element) => node instanceof HTMLElement && node.dataset.noCapture === 'true',
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

  // Import preview state: after parsing, show a preview before committing
  const [preview, setPreview]       = useState<{
    columns: string[]; rows: Row[]; delimiter: string;
  } | null>(null);

  // Chart refs for image export
  const refParticip                 = useRef<HTMLDivElement>(null);
  const refHeatmap                  = useRef<HTMLDivElement>(null);
  const refAnalysisTable            = useRef<HTMLDivElement>(null);
  const refAnalysisChart            = useRef<HTMLDivElement>(null);

  // Filters: column → Set of selected values
  const [filters, setFilters]       = useState<Record<string, Set<string>>>({});

  // UI state
  const [tab, setTab]               = useState<'participation' | 'analysis'>('participation');
  // Array of selected dim IDs: 0 = show nothing, 1 = bar chart, 2 = bar + 2D heatmap
  const [participDims, setParticipDims] = useState<string[]>([]);
  // Analysis tab state
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('csi-pillar-school');
  const [pillarMap, setPillarMap]   = useState<Record<string, number>>({});
  const [includedAttrs, setIncludedAttrs] = useState<Set<string>>(new Set());
  const [showPillarConfig, setShowPillarConfig] = useState(false);

  // ---- Load CSV: parse and show preview first -----------------------------
  const loadText = useCallback((text: string) => {
    const parsed = parseCSV(text);
    setPreview(parsed);
  }, []);

  // ---- Commit preview → dashboard -----------------------------------------
  const commitPreview = useCallback(() => {
    if (!preview) return;
    const { columns, rows } = preview;
    setColumns(columns);
    setAllRows(rows);
    setFilters({});
    setPreview(null);
    // Auto-select first categorical demographic column for participation tab
    const detected = detectDemoDims(columns, rows);
    if (detected.length > 0) setParticipDims([detected[0].id]);
    // Auto-init pillar map from csi_attribute values
    if (columns.includes('csi_attribute')) {
      const attrs = Array.from(new Set(rows.map(r => r['csi_attribute']).filter(Boolean)));
      const pm = autoAssignPillars(attrs);
      setPillarMap(pm);
      setIncludedAttrs(new Set(attrs));
    }
  }, [preview]);

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

  // ---- Import screen (only when no preview pending and no data loaded) -----
  if (allRows.length === 0 && !preview) {
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

  // ---- Import preview screen ----------------------------------------------
  if (preview) {
    const DELIM_LABELS: Record<string, string> = {
      '\t': 'Tab (TSV)',
      ',': 'Comma (CSV)',
      ';': 'Semicolon',
      '|': 'Pipe',
    };
    const sampleRows = preview.rows.slice(0, 3);
    return (
      <AdminShell>
        <div style={{ maxWidth: 900, fontFamily: 'DM Sans, sans-serif' }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Import Preview</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Verify the columns and sample rows look correct before continuing.
            </p>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Rows',      value: preview.rows.length.toLocaleString() },
              { label: 'Columns',   value: preview.columns.length.toString() },
              { label: 'Delimiter', value: DELIM_LABELS[preview.delimiter] ?? preview.delimiter },
            ].map(c => (
              <div key={c.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 18px', minWidth: 130 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Column list */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Detected Columns</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {preview.columns.map((col, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 10px', background: '#f3f4f6', borderRadius: 20, color: '#374151', fontWeight: 500 }}>
                  {col || <em style={{ color: '#9ca3af' }}>(blank)</em>}
                </span>
              ))}
            </div>
          </div>

          {/* Sample data table */}
          {sampleRows.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', marginBottom: 20, overflowX: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>First {sampleRows.length} Data Rows</div>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {preview.columns.map((col, i) => (
                      <th key={i} style={{ padding: '4px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {preview.columns.map((col, ci) => (
                        <td key={ci} style={{ padding: '4px 10px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row[col]}>
                          {row[col] || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={commitPreview}
              style={{ fontSize: 13, fontWeight: 600, color: 'white', background: '#3b6fce', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer' }}
            >
              Looks good — continue
            </button>
            <button
              onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 24px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AdminShell>
    );
  }

  // ---- Derived data -------------------------------------------------------
  // Column name helpers
  const schoolCol   = columns.includes('school_name')   ? 'school_name'   : columns.includes('school')    ? 'school'    : '';
  const gradeCol    = columns.includes('current_grade') ? 'current_grade' : columns.includes('grade')     ? 'grade'     : '';
  const langCol     = columns.includes('home_language') ? 'home_language' : columns.includes('language')  ? 'language'  : '';
  const districtCol = columns.includes('district_name') ? 'district_name' : columns.includes('district')  ? 'district'  : '';

  // Aliases so existing derived code doesn't need rewriting
  const participDim  = participDims[0] ?? '';
  const participDim2 = participDims[1] ?? '';

  // Participation
  const participCounts = participDim ? countBy(filteredRows, participDim) : {};
  const participSorted = Object.entries(participCounts).sort((a, b) => b[1] - a[1]);
  const participMax    = Math.max(...participSorted.map(x => x[1]), 1);

  // 2D heatmap data when two dims are selected
  const dim1Vals = participSorted.map(([v]) => v);
  const dim2Vals = participDim2 ? distinctSorted(filteredRows, participDim2).slice(0, 30) : [];
  const heatMax2d = dim1Vals.length > 0 && dim2Vals.length > 0 ? Math.max(
    ...dim1Vals.flatMap(d1 =>
      dim2Vals.map(d2 => filteredRows.filter(r => r[participDim] === d1 && r[participDim2] === d2).length),
    ), 1,
  ) : 1;

  const distinctDistricts = districtCol ? distinctSorted(allRows, districtCol).length : 0;
  const distinctSchools   = schoolCol   ? distinctSorted(allRows, schoolCol).length   : 0;
  const hasFilters        = Object.values(filters).some(s => s.size > 0);

  // ---- Word count derived data ---------------------------------------------
  const answerCol = columns.includes('answer') ? 'answer'
    : columns.includes('response') ? 'response' : '';
  const totalWords = answerCol ? totalWordCount(filteredRows, answerCol) : 0;
  const respondersWithText = answerCol ? filteredRows.filter(r => r[answerCol]?.trim()).length : 0;
  const avgWordsPerResponse = respondersWithText > 0 ? Math.round(totalWords / respondersWithText) : 0;

  // ---- Headline stats ------------------------------------------------------
  const participantCol = columns.includes('student_email') ? 'student_email'
    : columns.includes('email') ? 'email' : '';
  const uniqueParticipants = participantCol
    ? new Set(filteredRows.map(r => r[participantCol]).filter(v => v && !isBlankLike(v))).size
    : 0;
  const dataPointsAnalyzed = totalWords + filteredRows.length * columns.length;

  // Per-group word stats for the participation bar chart
  const participWordStats: Record<string, { total: number; avg: number }> = {};
  if (answerCol && participDim) {
    for (const [val] of participSorted) {
      const grp = filteredRows.filter(r => r[participDim] === val);
      const withText = grp.filter(r => r[answerCol]?.trim());
      const words = totalWordCount(withText, answerCol);
      participWordStats[val] = { total: words, avg: withText.length > 0 ? Math.round(words / withText.length) : 0 };
    }
  }

  // ---- Analysis tab derived data ------------------------------------------
  // Pillars 1-4: which attributes belong to each
  const pillarGroups: Record<1|2|3|4, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const attr of Array.from(includedAttrs)) {
    const p = (pillarMap[attr] ?? 1) as 1|2|3|4;
    if (p >= 1 && p <= 4) pillarGroups[p].push(attr);
  }
  // All csi_attributes known in the dataset (for config panel)
  const allCsiAttrs = distinctSorted(allRows, 'csi_attribute');

  // Helper: avg csi_adjusted for a set of rows filtered to specific attrs
  function csiAvg(rows: Row[], attrs: string[]): number | null {
    const nums = rows
      .filter(r => attrs.includes(r['csi_attribute']))
      .map(r => parseFloat(r['csi_adjusted']))
      .filter(n => !isNaN(n));
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  }

  // dim column for current analysis mode
  const analysisDimCol = ((): string => {
    if (analysisMode.includes('school'))   return schoolCol;
    if (analysisMode.includes('grade'))    return gradeCol;
    if (analysisMode.includes('language')) return langCol;
    return '';
  })();
  const analysisDimLabel = KNOWN_LABELS[analysisDimCol] ?? analysisDimCol;

  // CSI heatmap data: rows = dim values, cols = pillars 1-4
  const csiDimValues = analysisDimCol ? distinctSorted(filteredRows, analysisDimCol).slice(0, 40) : [];
  const csiHeatData = csiDimValues.map(dv => {
    const dimRows = filteredRows.filter(r => r[analysisDimCol] === dv);
    return {
      label: dv,
      pillars: ([1,2,3,4] as const).map(p => {
        const avg = csiAvg(dimRows, pillarGroups[p]);
        const n = dimRows.filter(r => pillarGroups[p].includes(r['csi_attribute']) && !isNaN(parseFloat(r['csi_adjusted']))).length;
        return { avg, n };
      }),
    };
  });

  // Color scale: normalize to actual data range so contrast isn't washed out
  const csiAllVals = csiHeatData.flatMap(r => r.pillars.map(p => p.avg)).filter((v): v is number => v !== null);
  const csiDataMin = csiAllVals.length ? Math.min(...csiAllVals) : 0;
  const csiDataMax = csiAllVals.length ? Math.max(...csiAllVals) : 1;
  // Returns normalized 0–1 within the actual data range, floored at 0.1
  function csiNorm(val: number | null): number {
    if (val === null) return 0;
    const range = csiDataMax - csiDataMin;
    const raw = range > 0.001 ? Math.max(0, Math.min(1, (val - csiDataMin) / range)) : 0.5;
    return 0.1 + raw * 0.9;
  }

  // =========================================================================
  return (
    <AdminShell>
      <div style={{ fontFamily: 'DM Sans, sans-serif', maxWidth: 1280 }}>

        {/* ---- Header ---------------------------------------------------- */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Data Analysis</h1>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                <strong style={{ color: '#111827' }}>{filteredRows.length.toLocaleString()}</strong>
                {hasFilters ? ` of ${allRows.length.toLocaleString()}` : ''}{' '}
                response{filteredRows.length !== 1 ? 's' : ''}
              </span>
              {totalWords > 0 && (
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  <strong style={{ color: '#111827' }}>{totalWords.toLocaleString()}</strong>{' '}
                  words of authentic voice
                </span>
              )}
              {distinctSchools > 0 && (
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  <strong style={{ color: '#111827' }}>{distinctSchools}</strong>{' '}
                  school{distinctSchools !== 1 ? 's' : ''}
                </span>
              )}
              {distinctDistricts > 0 && (
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  <strong style={{ color: '#111827' }}>{distinctDistricts}</strong>{' '}
                  district{distinctDistricts !== 1 ? 's' : ''}
                </span>
              )}
            </div>
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
          {(['participation', 'analysis'] as const).map(t => (
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

            {/* Headline stats */}
            {(() => {
              const cards = [
                { label: 'Responses',               value: filteredRows.length.toLocaleString(),  sub: null },
                ...(uniqueParticipants > 0 ? [{ label: 'Participants', value: uniqueParticipants.toLocaleString(), sub: null }] : []),
                ...(totalWords > 0 ? [{ label: 'Words of Authentic Voice', value: totalWords.toLocaleString(), sub: avgWordsPerResponse > 0 ? `avg ${avgWordsPerResponse} per response` : null }] : []),
                { label: 'Data Points Analyzed',    value: dataPointsAnalyzed.toLocaleString(),   sub: null },
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {cards.map(c => (
                    <div key={c.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{c.value}</div>
                      {c.sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{c.sub}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Chip selector — standalone card above the two-column grid */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>Dimension</span>
                <div data-no-capture="true" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {activeDemoDims.map((d) => {
                    const selIdx = participDims.indexOf(d.id);
                    const isFirst = selIdx === 0;
                    const isSecond = selIdx === 1;
                    const isSelected = selIdx !== -1;
                    return (
                      <button key={d.id} onClick={() => {
                        setParticipDims(prev =>
                          prev.includes(d.id)
                            ? prev.filter(x => x !== d.id)
                            : prev.length < 2 ? [...prev, d.id]
                            : [prev[1], d.id],
                        );
                      }} style={{
                        ...chipBase,
                        border: isSelected ? `1.5px solid ${isSecond ? '#8b5cf6' : '#3b6fce'}` : '1.5px solid #e5e7eb',
                        background: isSelected ? (isSecond ? '#8b5cf6' : '#3b6fce') : 'white',
                        color: isSelected ? 'white' : '#374151',
                        position: 'relative',
                      }}>
                        {isSelected && <span style={{ fontSize: 9, marginRight: 4, opacity: 0.85 }}>{isFirst ? '1' : '2'}</span>}
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>
                  {participDims.length < 2 ? 'Select up to 2 — click again to deselect' : 'Click a selected dimension to remove it'}
                </span>
              </div>
            </div>

            {/* Two-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

              {/* Left card */}
              <div ref={refParticip} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                {participDim2 ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                      {activeDemoDims.find(d => d.id === participDim)?.label ?? participDim}
                      {' × '}
                      {activeDemoDims.find(d => d.id === participDim2)?.label ?? participDim2}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>counts table</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '3px 8px 6px 4px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {activeDemoDims.find(d => d.id === participDim)?.label ?? participDim}
                            </th>
                            {dim2Vals.map(dv => (
                              <th key={dv} style={{ padding: '3px 8px 6px', textAlign: 'center', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{dv}</th>
                            ))}
                            <th style={{ padding: '3px 8px 6px', textAlign: 'center', color: '#374151', fontWeight: 700, borderLeft: '2px solid #e5e7eb' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dim1Vals.map(d1 => {
                            const rowTotal = filteredRows.filter(r => r[participDim] === d1).length;
                            return (
                              <tr key={d1} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '3px 8px 3px 4px', color: '#374151', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={d1}>{d1}</td>
                                {dim2Vals.map(d2 => {
                                  const cnt = filteredRows.filter(r => r[participDim] === d1 && r[participDim2] === d2).length;
                                  return (
                                    <td key={d2} style={{
                                      padding: '3px 8px', textAlign: 'center',
                                      background: heatColor(cnt, heatMax2d),
                                      color: cnt > heatMax2d * 0.55 ? 'white' : '#374151',
                                      fontWeight: cnt > 0 ? 600 : 400,
                                    }}>
                                      {cnt > 0 ? cnt.toLocaleString() : ''}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '3px 8px', textAlign: 'center', fontWeight: 700, color: '#111827', borderLeft: '2px solid #e5e7eb' }}>{rowTotal.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {dim2Vals.length === 30 && (
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Showing first 30 values for {activeDemoDims.find(d => d.id === participDim2)?.label ?? participDim2} — use filters to narrow.</p>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                      {participDim ? (activeDemoDims.find(d => d.id === participDim)?.label ?? participDim) : 'Select a dimension'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {participSorted.map(([val, cnt], i) => (
                        <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 120, fontSize: 11, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>{val}</div>
                          <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 18 }}>
                            <div style={{ width: `${(cnt / participMax) * 100}%`, height: '100%', background: pickColor(i), borderRadius: 4, transition: 'width 0.3s', minWidth: cnt > 0 ? 4 : 0 }} />
                          </div>
                          <div style={{ width: 40, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{cnt.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div data-no-capture="true" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => {
                      if (participDim2) {
                        const data = dim1Vals.map(d1 => {
                          const obj: Record<string, unknown> = { [participDim]: d1 };
                          dim2Vals.forEach(d2 => { obj[d2] = filteredRows.filter(r => r[participDim] === d1 && r[participDim2] === d2).length; });
                          obj.total = filteredRows.filter(r => r[participDim] === d1).length;
                          return obj;
                        });
                        exportCSV(data, `participation-${participDim}-${participDim2}.csv`);
                      } else {
                        exportCSV(
                          participSorted.map(([val, cnt]) => ({
                            [participDim]: val,
                            count: cnt,
                            ...(participWordStats[val] ? { total_words: participWordStats[val].total, avg_words: participWordStats[val].avg } : {}),
                          })),
                          `participation-by-${participDim}.csv`,
                        );
                      }
                    }}
                    style={exportBtn}
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={() => captureChart(refParticip, participDim2 ? `participation-${participDim}-${participDim2}.png` : `participation-by-${participDim}.png`)}
                    style={exportBtn}
                  >
                    Download image
                  </button>
                </div>
              </div>

              {/* Right card */}
              <div ref={refHeatmap} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                {participDim2 ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                      Stacked: {activeDemoDims.find(d => d.id === participDim)?.label ?? participDim}
                      {' × '}
                      {activeDemoDims.find(d => d.id === participDim2)?.label ?? participDim2}
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {dim2Vals.map((dv, i) => (
                        <div key={dv} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: pickColor(i), flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>{dv}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dim1Vals.map(d1 => {
                        const rowTotal = filteredRows.filter(r => r[participDim] === d1).length;
                        return (
                          <div key={d1} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 120, fontSize: 11, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d1}>{d1}</div>
                            <div style={{ flex: 1, display: 'flex', height: 20, borderRadius: 3, overflow: 'hidden' }}>
                              {dim2Vals.map((d2, i) => {
                                const cnt = filteredRows.filter(r => r[participDim] === d1 && r[participDim2] === d2).length;
                                const pct = rowTotal > 0 ? (cnt / rowTotal) * 100 : 0;
                                return pct > 0 ? (
                                  <div
                                    key={d2}
                                    title={`${d2}: ${cnt}`}
                                    style={{ width: `${pct}%`, height: '100%', background: pickColor(i), flexShrink: 0 }}
                                  />
                                ) : null;
                              })}
                            </div>
                            <div style={{ width: 36, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{rowTotal.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div data-no-capture="true" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button onClick={() => captureChart(refHeatmap, `participation-stacked-${participDim}-${participDim2}.png`)} style={exportBtn}>
                        Download image
                      </button>
                    </div>
                  </>
                ) : answerCol && Object.keys(participWordStats).length > 0 ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Avg Words per Response</div>
                    {(() => {
                      const wordMax = Math.max(...Object.values(participWordStats).map(w => w.avg), 1);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {participSorted.map(([val], i) => {
                            const ws = participWordStats[val];
                            if (!ws) return null;
                            return (
                              <div key={val} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 120, fontSize: 11, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>{val}</div>
                                <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 18 }}>
                                  <div style={{ width: `${(ws.avg / wordMax) * 100}%`, height: '100%', background: pickColor(i), borderRadius: 4, transition: 'width 0.3s', minWidth: ws.avg > 0 ? 4 : 0 }} />
                                </div>
                                <div style={{ width: 40, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{ws.avg}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div data-no-capture="true" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button
                        onClick={() => exportCSV(
                          participSorted.map(([val]) => ({
                            [participDim]: val,
                            avg_words: participWordStats[val]?.avg ?? 0,
                            total_words: participWordStats[val]?.total ?? 0,
                          })),
                          `word-count-by-${participDim}.csv`,
                        )}
                        style={exportBtn}
                      >
                        Download CSV
                      </button>
                      <button onClick={() => captureChart(refHeatmap, `word-count-by-${participDim}.png`)} style={exportBtn}>
                        Download image
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#9ca3af', padding: '20px 0' }}>
                    {answerCol ? 'No word count data available.' : 'No answer column detected. Select a second dimension to see a stacked bar chart.'}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ================================================================
            ANALYSIS TAB
        ================================================================ */}
        {tab === 'analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {!columns.includes('csi_attribute') && !columns.includes('csi_adjusted') ? (
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', color: '#9ca3af', fontSize: 13 }}>
                No CSI score data detected. Make sure your CSV includes <code>csi_attribute</code> and <code>csi_adjusted</code> columns.
              </div>
            ) : (
              <>
                {/* Analysis mode chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ANALYSIS_MODES.map(m => (
                    <button key={m.id} onClick={() => setAnalysisMode(m.id)} style={{
                      fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                      border: analysisMode === m.id ? '1.5px solid #3b6fce' : '1.5px solid #e5e7eb',
                      background: analysisMode === m.id ? '#3b6fce' : 'white',
                      color: analysisMode === m.id ? 'white' : '#374151',
                      transition: 'all 0.15s',
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Pillar configuration panel */}
                {allCsiAttrs.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <button
                      onClick={() => setShowPillarConfig(p => !p)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '13px 18px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#111827',
                      }}
                    >
                      <span>Configure Pillars</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                        {Array.from(includedAttrs).length} of {allCsiAttrs.length} attributes included
                        {' '}{showPillarConfig ? '▲' : '▼'}
                      </span>
                    </button>

                    {showPillarConfig && (
                      <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 14 }}>
                          {([1, 2, 3, 4] as const).map(p => {
                            const attrs = allCsiAttrs.filter(a => (pillarMap[a] ?? 1) === p);
                            const color = PILLAR_COLORS[p - 1];
                            return (
                              <div key={p} style={{ border: `1.5px solid ${color}44`, borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{ background: color, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Pillar {p}</span>
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <button
                                      onClick={() => setIncludedAttrs(prev => { const s = new Set(prev); attrs.forEach(a => s.add(a)); return s; })}
                                      style={{ fontSize: 10, color: 'white', background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
                                    >All</button>
                                    <button
                                      onClick={() => setIncludedAttrs(prev => { const s = new Set(prev); attrs.forEach(a => s.delete(a)); return s; })}
                                      style={{ fontSize: 10, color: 'white', background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
                                    >None</button>
                                  </div>
                                </div>
                                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {attrs.length === 0 ? (
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>No attributes assigned</span>
                                  ) : attrs.map(a => (
                                    <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={includedAttrs.has(a)}
                                        onChange={() => setIncludedAttrs(prev => {
                                          const s = new Set(prev);
                                          if (s.has(a)) s.delete(a); else s.add(a);
                                          return s;
                                        })}
                                        style={{ flexShrink: 0 }}
                                      />
                                      <span style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={a}>{a}</span>
                                      <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                        {([1, 2, 3, 4] as const).filter(pp => pp !== p).map(pp => (
                                          <button
                                            key={pp}
                                            onClick={e => { e.preventDefault(); setPillarMap(prev => ({ ...prev, [a]: pp })); }}
                                            title={`Move to Pillar ${pp}`}
                                            style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: `1px solid ${PILLAR_COLORS[pp - 1]}`, color: PILLAR_COLORS[pp - 1], background: 'white', cursor: 'pointer' }}
                                          >P{pp}</button>
                                        ))}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ---- Two-column grid: heatmap table (left) + bar chart (right) ---- */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

                  {/* Left card — heatmap table */}
                  <div ref={refAnalysisTable} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', overflowX: 'auto' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                      Heatmap — {analysisDimLabel}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
                      colour scaled to data range · 3dp
                    </div>

                      {!analysisDimCol ? (
                        <p style={{ fontSize: 13, color: '#9ca3af' }}>No {analysisDimLabel} column found in your data.</p>
                      ) : csiHeatData.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#9ca3af' }}>No data for this breakdown.</p>
                      ) : (
                        <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '3px 10px 6px 4px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {analysisDimLabel}
                              </th>
                              {([1, 2, 3, 4] as const).map(p => (
                                <th key={p} style={{ padding: '3px 10px 6px', textAlign: 'center', color: PILLAR_COLORS[p - 1], fontWeight: 700, whiteSpace: 'nowrap', minWidth: 80 }}>
                                  Pillar {p}
                                  <span style={{ display: 'block', fontSize: 9, fontWeight: 400, color: '#9ca3af', marginTop: 1 }}>
                                    {pillarGroups[p].length} attr{pillarGroups[p].length !== 1 ? 's' : ''}
                                  </span>
                                </th>
                              ))}
                              <th style={{ padding: '3px 10px 6px', textAlign: 'center', color: '#374151', fontWeight: 700, whiteSpace: 'nowrap', borderLeft: '2px solid #e5e7eb' }}>
                                Overall
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {csiHeatData.map(row => {
                              const allIncludedAttrs = ([1, 2, 3, 4] as const).flatMap(p => pillarGroups[p]);
                              const dimRows = filteredRows.filter(r => r[analysisDimCol] === row.label);
                              const overallAvg = csiAvg(dimRows, allIncludedAttrs);
                              const overallN = dimRows.filter(r => allIncludedAttrs.includes(r['csi_attribute']) && !isNaN(parseFloat(r['csi_adjusted']))).length;
                              const t_overall = csiNorm(overallAvg);
                              return (
                                <tr key={row.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '3px 10px 3px 4px', color: '#374151', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.label}>
                                    {row.label}
                                  </td>
                                  {row.pillars.map(({ avg, n }, pi) => {
                                    const t = csiNorm(avg);
                                    return (
                                      <td key={pi} style={{
                                        padding: '3px 10px', textAlign: 'center',
                                        background: csiColor(t), color: t > 0.5 ? 'white' : '#374151',
                                        fontWeight: avg !== null ? 600 : 400,
                                      }}>
                                        {avg !== null ? (
                                          <>
                                            {avg.toFixed(3)}
                                            <span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>n={n.toLocaleString()}</span>
                                          </>
                                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                                      </td>
                                    );
                                  })}
                                  <td style={{
                                    padding: '3px 10px', textAlign: 'center',
                                    background: csiColor(t_overall), color: t_overall > 0.5 ? 'white' : '#374151',
                                    fontWeight: 700, borderLeft: '2px solid #e5e7eb',
                                  }}>
                                    {overallAvg !== null ? (
                                      <>
                                        {overallAvg.toFixed(3)}
                                        <span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>n={overallN.toLocaleString()}</span>
                                      </>
                                    ) : <span style={{ color: '#d1d5db' }}>—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Summary row */}
                            {csiHeatData.length > 1 && (
                              <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                                <td style={{ padding: '3px 10px 3px 4px', fontSize: 11, fontWeight: 700, color: '#111827' }}>
                                  All {analysisDimLabel}s
                                </td>
                                {([1, 2, 3, 4] as const).map(p => {
                                  const avg = csiAvg(filteredRows, pillarGroups[p]);
                                  const n = filteredRows.filter(r => pillarGroups[p].includes(r['csi_attribute']) && !isNaN(parseFloat(r['csi_adjusted']))).length;
                                  const t = csiNorm(avg);
                                  return (
                                    <td key={p} style={{ padding: '3px 10px', textAlign: 'center', background: csiColor(t), color: t > 0.5 ? 'white' : '#374151', fontWeight: 700 }}>
                                      {avg !== null ? <>{avg.toFixed(3)}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>n={n.toLocaleString()}</span></> : '—'}
                                    </td>
                                  );
                                })}
                                {(() => {
                                  const allIncludedAttrs = ([1, 2, 3, 4] as const).flatMap(p => pillarGroups[p]);
                                  const grandAvg = csiAvg(filteredRows, allIncludedAttrs);
                                  const grandN = filteredRows.filter(r => allIncludedAttrs.includes(r['csi_attribute']) && !isNaN(parseFloat(r['csi_adjusted']))).length;
                                  const t = csiNorm(grandAvg);
                                  return (
                                    <td style={{ padding: '3px 10px', textAlign: 'center', fontWeight: 700, background: csiColor(t), color: t > 0.5 ? 'white' : '#374151', borderLeft: '2px solid #e5e7eb' }}>
                                      {grandAvg !== null ? <>{grandAvg.toFixed(3)}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>n={grandN.toLocaleString()}</span></> : '—'}
                                    </td>
                                  );
                                })()}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}

                    <div data-no-capture="true" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button
                        onClick={() => {
                          const data = csiHeatData.map(row => {
                            const obj: Record<string, unknown> = { [analysisDimCol]: row.label };
                            ([1, 2, 3, 4] as const).forEach((p, pi) => {
                              obj[`pillar_${p}`] = row.pillars[pi].avg?.toFixed(3) ?? '';
                              obj[`pillar_${p}_n`] = row.pillars[pi].n;
                            });
                            const allIncludedAttrs = ([1, 2, 3, 4] as const).flatMap(pp => pillarGroups[pp]);
                            const dimRows2 = filteredRows.filter(r => r[analysisDimCol] === row.label);
                            obj.overall = csiAvg(dimRows2, allIncludedAttrs)?.toFixed(3) ?? '';
                            obj.overall_n = dimRows2.filter(r => allIncludedAttrs.includes(r['csi_attribute']) && !isNaN(parseFloat(r['csi_adjusted']))).length;
                            return obj;
                          });
                          exportCSV(data, `csi-pillar-${analysisDimCol}.csv`);
                        }}
                        style={exportBtn}
                      >Download CSV</button>
                      <button onClick={() => captureChart(refAnalysisTable, `csi-heatmap-${analysisDimCol}.png`)} style={exportBtn}>
                        Download image (table)
                      </button>
                    </div>
                  </div>

                  {/* Right card — bar chart */}
                  <div ref={refAnalysisChart} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                      Bar Chart — {analysisDimLabel}
                    </div>
                    {/* Pillar legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                      {([1, 2, 3, 4] as const).filter(p => pillarGroups[p].length > 0).map(p => (
                        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: PILLAR_COLORS[p - 1], flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>Pillar {p}</span>
                        </div>
                      ))}
                    </div>
                    {csiHeatData.length === 0 || !analysisDimCol ? (
                      <p style={{ fontSize: 13, color: '#9ca3af' }}>No data for this breakdown.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {csiHeatData.map(row => (
                          <div key={row.label}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.label}>
                              {row.label}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {([1, 2, 3, 4] as const).filter(p => pillarGroups[p].length > 0).map((p) => {
                                const { avg, n } = row.pillars[p - 1];
                                const pct = avg !== null && csiDataMax > 0 ? (avg / csiDataMax) * 100 : 0;
                                return (
                                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 18, fontSize: 9, color: PILLAR_COLORS[p - 1], fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>P{p}</span>
                                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 3, height: 16, position: 'relative', overflow: 'hidden' }}>
                                      {avg !== null && (
                                        <div style={{ width: `${pct}%`, height: '100%', background: PILLAR_COLORS[p - 1], borderRadius: 3, opacity: 0.85 }} />
                                      )}
                                    </div>
                                    <span style={{ width: 40, fontSize: 10, color: '#374151', fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>
                                      {avg !== null ? avg.toFixed(3) : '—'}
                                    </span>
                                    <span style={{ width: 44, fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>n={n.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div data-no-capture="true" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button onClick={() => captureChart(refAnalysisChart, `csi-barchart-${analysisDimCol}.png`)} style={exportBtn}>
                        Download image (chart)
                      </button>
                    </div>
                  </div>

                </div>

              </>
            )}
          </div>
        )}

      </div>
    </AdminShell>
  );
}
