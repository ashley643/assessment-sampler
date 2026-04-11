'use client';

import { useEffect, useState } from 'react';

interface Context {
  respondents?: string[];
  gradeLevels?: string[];
  expectedCount?: string;
  launchTimeline?: string;
  communityModel?: string | null;
  primaryGoal?: string | null;
  competencyFocus?: string | null;
  screeningScope?: string | null;
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

const TYPE_LABELS: Record<string, string> = {
  'community-schools': 'Community Schools',
  'learner-portrait': 'Learner Portrait',
  'behavioral-health': 'Behavioral Health',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PilotSubmissionsClient() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pilot')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setSubmissions(d);
      })
      .catch(() => setError('Failed to load submissions'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pilot Intake Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">Submissions from <code className="bg-gray-100 px-1 rounded">/pilot</code></p>
        </div>

        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && submissions.length === 0 && (
          <p className="text-sm text-gray-400">No submissions yet.</p>
        )}

        {submissions.length > 0 && (
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                      <p className="text-sm text-gray-700">{formatDate(s.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Contact</p>
                      <p className="text-sm font-medium text-gray-900">{s.contact_name}</p>
                      <p className="text-xs text-gray-500">{s.contact_email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Organization</p>
                      <p className="text-sm text-gray-700">{s.contact_org}</p>
                      {s.contact_role && <p className="text-xs text-gray-500">{s.contact_role}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Assessment</p>
                      <span className="inline-block text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[s.assessment_type] ?? s.assessment_type}
                      </span>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expanded === s.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {expanded === s.id && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                    <div className="grid grid-cols-2 gap-6 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Context</p>
                        <dl className="space-y-1">
                          {s.context.respondents?.length ? (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Respondents</dt><dd className="text-gray-700">{s.context.respondents.join(', ')}</dd></div>
                          ) : null}
                          {s.context.gradeLevels?.length ? (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Grades</dt><dd className="text-gray-700">{s.context.gradeLevels.join(', ')}</dd></div>
                          ) : null}
                          {s.context.expectedCount && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Expected count</dt><dd className="text-gray-700">{s.context.expectedCount}</dd></div>
                          )}
                          {s.context.launchTimeline && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Launch timeline</dt><dd className="text-gray-700">{s.context.launchTimeline}</dd></div>
                          )}
                          {s.context.communityModel && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Community model</dt><dd className="text-gray-700">{s.context.communityModel}</dd></div>
                          )}
                          {s.context.primaryGoal && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Primary goal</dt><dd className="text-gray-700">{s.context.primaryGoal}</dd></div>
                          )}
                          {s.context.competencyFocus && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Competency focus</dt><dd className="text-gray-700">{s.context.competencyFocus}</dd></div>
                          )}
                          {s.context.screeningScope && (
                            <div className="flex gap-2"><dt className="text-gray-500 w-32 shrink-0">Screening scope</dt><dd className="text-gray-700">{s.context.screeningScope}</dd></div>
                          )}
                        </dl>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Contact</p>
                        <dl className="space-y-1">
                          <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Name</dt><dd className="text-gray-700">{s.contact_name}</dd></div>
                          <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Email</dt><dd className="text-gray-700">{s.contact_email}</dd></div>
                          {s.contact_role && <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Role</dt><dd className="text-gray-700">{s.contact_role}</dd></div>}
                          {s.contact_phone && <div className="flex gap-2"><dt className="text-gray-500 w-20 shrink-0">Phone</dt><dd className="text-gray-700">{s.contact_phone}</dd></div>}
                        </dl>
                        {s.notes && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
                            <p className="text-sm text-gray-600 bg-white rounded p-2 border border-gray-200">{s.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
