'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';

type Stage = 'new' | 'follow-up' | 'build' | 'execute' | 'report' | 'cancelled';

interface Context {
  respondents?: string[];
  gradeLevels?: string[];
  expectedCount?: string;
  launchTimeline?: string;
  dateNotes?: string | null;
  onsiteSupport?: string | null;
  wantsCustomIntro?: string | null;
  communityModel?: string | null;
  primaryGoal?: string | null;
  primaryGoalOther?: string | null;
  competencyFocus?: string | null;
  screeningScope?: string | null;
  languages?: string[] | null;
  otherLanguage?: string | null;
  modalities?: string[] | null;
  demographics?: string[] | null;
  demographicsOther?: string | null;
  bhSelectedAssessments?: string[] | null;
  bhWantsCustom?: boolean | null;
  lpSelectedAssessments?: string[] | null;
  lpWantsCustom?: boolean | null;
  stage?: Stage;
}

interface Submission {
  id: string;
  created_at: string;
  assessment_type: string;
  context: Context;
  contact_name: string;
  contact_email: string;
  contact_role: string | null;
  contact_org: string;
  contact_phone: string | null;
  notes: string | null;
}

const STAGES: { key: Stage; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { key: 'new',       label: 'New',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af' },
  { key: 'follow-up', label: 'Follow-Up', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  { key: 'build',     label: 'Build',     color: '#b45309', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b' },
  { key: 'execute',   label: 'Execute',   color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', dot: '#8b5cf6' },
  { key: 'report',    label: 'Report',    color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', dot: '#10b981' },
  { key: 'cancelled', label: 'Cancelled', color: '#991b1b', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<Stage, typeof STAGES[0]>;

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'community-schools': { label: 'Community Schools', color: '#1e40af', bg: '#dbeafe' },
  'learner-portrait':  { label: 'Learner Portrait',  color: '#5b21b6', bg: '#ede9fe' },
  'behavioral-health': { label: 'Behavioral Health', color: '#065f46', bg: '#d1fae5' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 24) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diffH < 24 * 7) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DetailRow({ label, value }: { label: string; value?: string | string[] | null }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(', ') : value;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="text-gray-400 w-36 shrink-0">{label}</dt>
      <dd className="text-gray-700">{display}</dd>
    </div>
  );
}

export default function PilotFormsClient() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const load = useCallback(() => {
    fetch('/api/pilot')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setSubmissions(d); })
      .catch(() => setError('Failed to load submissions'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStage(id: string, stage: Stage) {
    setUpdatingStage(id);
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, context: { ...s.context, stage } } : s));
    await fetch('/api/pilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    });
    setUpdatingStage(null);
  }

  async function deleteSubmission(id: string) {
    if (!confirm('Delete this submission permanently? This cannot be undone.')) return;
    setSubmissions(prev => prev.filter(s => s.id !== id));
    setSelected(null);
    await fetch(`/api/pilot?id=${id}`, { method: 'DELETE' });
  }

  const filtered = stageFilter === 'all'
    ? submissions
    : submissions.filter(s => (s.context.stage ?? 'new') === stageFilter);

  const counts = Object.fromEntries(
    STAGES.map(s => [s.key, submissions.filter(sub => (sub.context.stage ?? 'new') === s.key).length])
  ) as Record<Stage, number>;

  const selectedSub = submissions.find(s => s.id === selected) ?? null;

  return (
    <AdminShell>
      <div className="flex h-full" style={{ height: 'calc(100vh - 0px)' }}>

        {/* ── Left pane: inbox list ── */}
        <div className="flex flex-col border-r border-gray-200 bg-white" style={{ width: 420, minWidth: 320, flexShrink: 0 }}>

          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-base font-semibold text-gray-900">Pilot Forms</h1>
              <span className="text-xs text-gray-400">{submissions.length} total</span>
            </div>
            {/* Stage filter tabs */}
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setStageFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${stageFilter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                All <span className="ml-0.5 opacity-60">{submissions.length}</span>
              </button>
              {STAGES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setStageFilter(s.key)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${stageFilter === s.key ? 'text-white' : 'hover:bg-gray-100'}`}
                  style={stageFilter === s.key ? { background: s.dot } : { color: s.color }}
                >
                  {s.label} <span className="ml-0.5 opacity-70">{counts[s.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && <p className="text-sm text-gray-400 px-5 py-6">Loading…</p>}
            {error && <p className="text-sm text-red-500 px-5 py-6">{error}</p>}
            {!loading && !error && filtered.length === 0 && (
              <p className="text-sm text-gray-400 px-5 py-6">No submissions{stageFilter !== 'all' ? ` in ${STAGE_MAP[stageFilter].label}` : ''}.</p>
            )}
            {filtered.map(s => {
              const stage = (s.context.stage ?? 'new') as Stage;
              const stageInfo = STAGE_MAP[stage];
              const typeInfo = TYPE_CONFIG[s.assessment_type];
              const isSelected = selected === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelected(isSelected ? null : s.id); setShowMore(false); }}
                  className={`w-full text-left px-5 py-4 border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.contact_org}</p>
                    <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatDate(s.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-2">{s.contact_name} · {s.contact_email}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {typeInfo && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: typeInfo.color, background: typeInfo.bg }}>
                        {typeInfo.label}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ color: stageInfo.color, background: stageInfo.bg, borderColor: stageInfo.border }}>
                      {stageInfo.label}
                    </span>
                    {s.context.launchTimeline && (
                      <span className="text-[10px] text-gray-400 truncate">{s.context.launchTimeline}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right pane: detail ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {!selectedSub ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Select a submission to view details
            </div>
          ) : (() => {
            const stage = (selectedSub.context.stage ?? 'new') as Stage;
            const typeInfo = TYPE_CONFIG[selectedSub.assessment_type];
            return (
              <div className="max-w-2xl mx-auto px-8 py-8 space-y-7">

                {/* Title row */}
                <div>
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h2 className="text-xl font-bold text-gray-900">{selectedSub.contact_org}</h2>
                    <span className="text-xs text-gray-400 shrink-0 pt-1">{formatDate(selectedSub.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeInfo && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ color: typeInfo.color, background: typeInfo.bg }}>
                        {typeInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage selector */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stage</p>
                  <div className="flex gap-2 flex-wrap">
                    {STAGES.map(s => {
                      const isActive = stage === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setStage(selectedSub.id, s.key)}
                          disabled={updatingStage === selectedSub.id}
                          className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border transition-all"
                          style={isActive
                            ? { background: s.bg, color: s.color, borderColor: s.border, boxShadow: `0 0 0 2px ${s.border}` }
                            : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                          }
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: isActive ? s.dot : '#d1d5db' }} />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
                  <DetailRow label="Name" value={selectedSub.contact_name} />
                  <DetailRow label="Email" value={selectedSub.contact_email} />
                  <DetailRow label="Role" value={selectedSub.contact_role} />
                  <DetailRow label="Organization" value={selectedSub.contact_org} />
                  <DetailRow label="Phone" value={selectedSub.contact_phone} />
                  {selectedSub.contact_email && (
                    <div className="pt-2">
                      <a
                        href={`mailto:${selectedSub.contact_email}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Send email →
                      </a>
                    </div>
                  )}
                </div>

                {/* Assessment context */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Assessment Details</p>
                  <DetailRow label="Type" value={typeInfo?.label ?? selectedSub.assessment_type} />
                  <DetailRow label="Launch timeline" value={selectedSub.context.launchTimeline} />
                  <DetailRow label="Expected count" value={selectedSub.context.expectedCount} />
                  <DetailRow label="Respondents" value={selectedSub.context.respondents} />
                  <DetailRow label="Grade levels" value={selectedSub.context.gradeLevels} />

                  {showMore && (
                    <div className="space-y-1 pt-1">
                      <DetailRow label="Date notes" value={selectedSub.context.dateNotes} />
                      <DetailRow label="Languages" value={selectedSub.context.languages} />
                      <DetailRow label="Other language" value={selectedSub.context.otherLanguage} />
                      <DetailRow label="Modalities" value={selectedSub.context.modalities} />
                      <DetailRow label="Demographics" value={selectedSub.context.demographics} />
                      <DetailRow label="Demographics other" value={selectedSub.context.demographicsOther} />
                      <DetailRow label="Onsite support" value={selectedSub.context.onsiteSupport} />
                      <DetailRow label="Custom intro" value={selectedSub.context.wantsCustomIntro} />
                      <DetailRow label="Primary goal" value={selectedSub.context.primaryGoal} />
                      <DetailRow label="Primary goal other" value={selectedSub.context.primaryGoalOther} />
                      <DetailRow label="Community model" value={selectedSub.context.communityModel} />
                      <DetailRow label="Competency focus" value={selectedSub.context.competencyFocus} />
                      <DetailRow label="Screening scope" value={selectedSub.context.screeningScope} />
                      <DetailRow label="BH assessments" value={selectedSub.context.bhSelectedAssessments} />
                      {selectedSub.context.bhWantsCustom != null && (
                        <DetailRow label="BH custom?" value={selectedSub.context.bhWantsCustom ? 'Yes' : 'No'} />
                      )}
                      <DetailRow label="LP assessments" value={selectedSub.context.lpSelectedAssessments} />
                      {selectedSub.context.lpWantsCustom != null && (
                        <DetailRow label="LP custom?" value={selectedSub.context.lpWantsCustom ? 'Yes' : 'No'} />
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => setShowMore(v => !v)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {showMore ? 'Show less ↑' : 'View more details ↓'}
                    </button>
                  </div>
                </div>

                {/* Notes */}
                {selectedSub.notes && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes from submitter</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedSub.notes}</p>
                  </div>
                )}

                {/* Meta + Delete */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Submitted {new Date(selectedSub.created_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                    {' · '}ID: <code className="bg-gray-100 px-1 rounded">{selectedSub.id}</code>
                  </p>
                  <button
                    onClick={() => deleteSubmission(selectedSub.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </AdminShell>
  );
}
