'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

interface AuditRow {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create_code: 'Created code',
  update_code: 'Updated code',
  delete_code: 'Deleted code',
  create_assessment: 'Created assessment',
  update_assessment: 'Updated assessment',
  delete_assessment: 'Deleted assessment',
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/audit')
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setTotal(d.total ?? 0); setLoading(false); });
  }, []);

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
          {total > 0 && <span className="text-sm text-gray-400">{total} entries</span>}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400">No audit entries yet. Actions taken in the admin will appear here.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">When</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Who</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Entity</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => (
                  <>
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{row.actor_email}</td>
                      <td className="px-4 py-3 text-gray-800 text-xs font-medium">
                        {ACTION_LABELS[row.action] ?? row.action}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {row.entity_type && <span className="font-mono">{row.entity_type}</span>}
                        {row.entity_id && <span className="ml-1 text-gray-400">#{row.entity_id}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(row.before || row.after) && (
                          <button
                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            {expanded === row.id ? 'Hide' : 'Details'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === row.id && (
                      <tr key={`${row.id}-detail`} className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {row.before && (
                              <div>
                                <p className="font-medium text-gray-500 mb-1">Before</p>
                                <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-48 text-gray-700 font-mono text-[11px]">
                                  {JSON.stringify(row.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {row.after && (
                              <div>
                                <p className="font-medium text-gray-500 mb-1">After</p>
                                <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-48 text-gray-700 font-mono text-[11px]">
                                  {JSON.stringify(row.after, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
