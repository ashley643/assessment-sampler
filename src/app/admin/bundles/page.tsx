'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';

interface Bundle {
  id: string;
  title: string;
  accent_color: string;
  badge_bg: string;
  badge_text: string;
  description: string | null;
  sort_order: number;
  bundle_assessments: { assessment_id: string; assessments: { title: string } }[];
}

export default function BundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Bundle | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/bundles');
    const data = await res.json();
    setBundles(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    await fetch(`/api/admin/bundles/${confirmDelete.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    setDeleting(false);
    await load();
  }

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Bundles</h1>
            <p className="text-sm text-gray-400 mt-0.5">Group related assessments into a selector experience</p>
          </div>
          <Link href="/admin/bundles/new" className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] transition-colors">
            + New Bundle
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : bundles.length === 0 ? (
          <p className="text-sm text-gray-400">No bundles yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Bundle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Assessments</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bundles.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.accent_color }} />
                        <div>
                          <span className="text-gray-900 font-medium">{b.title}</span>
                          {b.description && <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {(b.bundle_assessments ?? [])
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(ba => (
                            <span key={ba.assessment_id} className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 text-xs">
                              {ba.assessments?.title}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-4">
                      <Link href={`/admin/bundles/${b.id}`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                      <button onClick={() => setConfirmDelete(b)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete bundle?</h2>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{confirmDelete.title}</strong> will be deleted. The individual assessments inside it will not be affected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
