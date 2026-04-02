'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';

interface Assessment {
  id: string;
  title: string;
  type_label: string;
  accent_color: string;
  description: string | null;
  sort_order: number;
  questions: { id: string }[];
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/admin/assessments');
    setAssessments(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Assessments</h1>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : assessments.length === 0 ? (
          <p className="text-sm text-gray-400">No assessments found.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Questions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Order</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assessments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: a.accent_color }}
                        />
                        <span className="text-gray-900 font-medium">{a.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{a.type_label}</td>
                    <td className="px-4 py-3 text-gray-500">{a.questions?.length ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{a.sort_order}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/assessments/${a.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
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
