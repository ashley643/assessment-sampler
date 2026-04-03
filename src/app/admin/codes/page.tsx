'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';

interface Code {
  id: string;
  code: string;
  label: string;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  code_assessments: { sort_order: number; assessment_id: string | null; bundle_id: string | null; assessments: { title: string } | null; bundles: { title: string } | null }[];
}

export default function CodesPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/admin/codes');
    setCodes(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete code "${code}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/codes/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Access Codes</h1>
          <Link
            href="/admin/codes/new"
            className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] transition-colors"
          >
            + New Code
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-400">No access codes yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Assessments</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {codes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{c.code}</td>
                    <td className="px-4 py-3 text-gray-700">{c.label}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.code_assessments
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(ca => ca.bundles?.title ?? ca.assessments?.title)
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-4">
                      <a
                        href={`/assessment/${c.code}?preview=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Preview
                      </a>
                      <Link href={`/admin/codes/${c.id}`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                      <button onClick={() => handleDelete(c.id, c.code)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
