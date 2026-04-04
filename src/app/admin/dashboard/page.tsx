'use client';

import { useEffect, useState } from 'react';

const EVENT_LABELS: Record<string, string> = {
  session_start: 'Started a session',
  assessment_open: 'Opened an assessment',
  question_view: 'Viewed a question',
  question_complete: 'Completed a question',
  assessment_complete: 'Completed an assessment',
  mode_change: 'Switched to a different response format',
  text_response: 'Submitted a typed response',
};
import AdminShell from '@/components/admin/AdminShell';

interface AnalyticsData {
  sessions: number;
  events: number;
  byType: Record<string, number>;
  byAssessment: Record<string, number>;
  byCode: Record<string, number>;
  daily: { date: string; count: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days) });
    if (selectedCode) params.set('code', selectedCode);
    fetch(`/api/admin/analytics?${params}`)
      .then(r => r.json())
      .then(setData);
  }, [days, selectedCode]);

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            {selectedCode && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">
                {selectedCode}
                <button
                  onClick={() => setSelectedCode(null)}
                  className="ml-1 hover:text-blue-900 font-bold leading-none"
                  title="Clear filter"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {!data ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <StatCard label="Total Visits" value={data.sessions} />
              <StatCard label="Total Actions" value={data.events} />
            </div>

            {/* By code — clickable for drill-down */}
            {Object.keys(data.byCode).length > 0 && (
              <Section title={selectedCode ? `Visits — ${selectedCode}` : 'Visits by Access Code'}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Code</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.entries(data.byCode)
                      .sort((a, b) => b[1] - a[1])
                      .map(([code, count]) => (
                        <tr
                          key={code}
                          className={`cursor-pointer transition-colors ${
                            selectedCode === code
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedCode(selectedCode === code ? null : code)}
                          title={selectedCode === code ? 'Click to clear filter' : `Click to filter by ${code}`}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-900 flex items-center gap-2">
                            {selectedCode === code && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                            {code}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* By assessment */}
            {Object.keys(data.byAssessment).length > 0 && (
              <Section title="Activity by Assessment">
                <Table
                  rows={Object.entries(data.byAssessment).sort((a, b) => b[1] - a[1])}
                  colA="Assessment"
                  colB="Actions"
                />
              </Section>
            )}

            {/* By event type */}
            {Object.keys(data.byType).length > 0 && (
              <Section title="Activity Breakdown">
                <Table
                  rows={Object.entries(data.byType).sort((a, b) => b[1] - a[1])}
                  colA="Action"
                  colB="Count"
                />
              </Section>
            )}

            {/* Daily chart */}
            {data.daily.length > 0 && (
              <Section title="Daily Visits">
                <div className="space-y-1.5">
                  {data.daily.map(d => {
                    const max = Math.max(...data.daily.map(x => x.count));
                    const pct = max > 0 ? (d.count / max) * 100 : 0;
                    return (
                      <div key={d.date} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-gray-500 tabular-nums">{new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-400 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-gray-700 tabular-nums">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {data.sessions === 0 && (
              <p className="text-sm text-gray-400 mt-4">
                No activity yet{selectedCode ? ` for ${selectedCode}` : ' for this period'}.
              </p>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-semibold text-gray-900 tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-gray-700 mb-3">{title}</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{children}</div>
    </div>
  );
}

function Table({ rows, colA, colB }: { rows: [string, number][]; colA: string; colB: string }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-100">
        <tr>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{colA}</th>
          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">{colB}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(([key, val]) => (
          <tr key={key} className="hover:bg-gray-50">
            <td className="px-4 py-2.5 text-gray-800 text-xs">{EVENT_LABELS[key] ?? key}</td>
            <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
