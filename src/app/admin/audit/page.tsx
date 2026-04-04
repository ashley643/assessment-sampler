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
  create_code: 'Created access code',
  update_code: 'Updated access code',
  delete_code: 'Deleted access code',
  create_assessment: 'Created assessment',
  update_assessment: 'Saved assessment',
  delete_assessment: 'Deleted assessment',
  create_bundle: 'Created bundle',
  update_bundle: 'Saved bundle',
  delete_bundle: 'Deleted bundle',
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  type: 'Type ID',
  type_label: 'Type',
  accent_color: 'Accent color',
  badge_bg: 'Badge background',
  badge_text: 'Badge text color',
  player_label: 'Player label',
  code: 'Access code',
  label: 'Label',
  is_active: 'Active',
  starts_at: 'Start date',
  expires_at: 'Expiry date',
  assessment_ids: 'Assessments',
  bundle_ids: 'Bundles',
  questions: 'Questions',
  sort_order: 'Order',
};

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (key === 'is_active') return value ? 'Yes' : 'No';
  if (key === 'starts_at' || key === 'expires_at') {
    return value ? new Date(value as string).toLocaleDateString() : '—';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'number' && key === 'questions') return `${value} question${value === 1 ? '' : 's'}`;
  return String(value);
}

function FieldTable({ label, data }: { label: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => k !== 'id' && k !== 'sort_order');
  return (
    <div>
      <p className="font-medium text-gray-500 mb-1.5">{label}</p>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-3 px-3 py-1.5 border-b border-gray-50 last:border-0">
            <span className="text-gray-400 w-32 flex-shrink-0">{FIELD_LABELS[key] ?? key}</span>
            <span className="text-gray-700 break-all">{formatFieldValue(key, value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function friendlyEntity(row: AuditRow) {
  const name = row.entity_id ?? row.entity_type;
  if (!name) return null;
  // If it looks like a raw UUID or slug ID, prefer the title from after/before
  const title = (row.after as Record<string, unknown> | null)?.title
    ?? (row.before as Record<string, unknown> | null)?.title
    ?? (row.after as Record<string, unknown> | null)?.code
    ?? (row.before as Record<string, unknown> | null)?.code;
  return (title as string | undefined) ?? name;
}

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
                        {friendlyEntity(row) && <span>{friendlyEntity(row)}</span>}
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
                            {row.before && <FieldTable label="Before" data={row.before} />}
                            {row.after && <FieldTable label="After" data={row.after} />}
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
