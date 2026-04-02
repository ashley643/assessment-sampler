'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  async function load() {
    const res = await fetch('/api/admin/assessments');
    const data = await res.json();
    setAssessments(data.sort((a: Assessment, b: Assessment) => a.sort_order - b.sort_order));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOver(idx);
  }

  async function onDrop(dropIndex: number) {
    const from = dragIdx.current;
    if (from === null || from === dropIndex) { setDragOver(null); return; }

    const reordered = [...assessments];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dropIndex, 0, moved);
    const updated = reordered.map((a, i) => ({ ...a, sort_order: i }));
    setAssessments(updated);
    setDragOver(null);
    dragIdx.current = null;

    setSaving(true);
    await fetch('/api/admin/assessments/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated.map(a => ({ id: a.id, sort_order: a.sort_order }))),
    });
    setSaving(false);
  }

  async function handleDuplicate(a: Assessment) {
    setDuplicating(a.id);
    const res = await fetch(`/api/admin/assessments/${a.id}`);
    const full = await res.json();

    const newId = `${a.id}-copy-${Date.now()}`;
    await fetch('/api/admin/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...full,
        id: newId,
        title: `${full.title} (Copy)`,
        sort_order: full.sort_order + 1,
        questions: full.questions.map((q: { id: string; title: string; sort_order: number; embed_url: string; spanish_embed_url: string | null }) => ({
          ...q,
          id: `${q.id}-copy-${Date.now()}`,
        })),
      }),
    });

    await load();
    setDuplicating(null);
    router.push(`/admin/assessments/${newId}`);
  }

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Assessments</h1>
            {saving && <span className="text-xs text-gray-400">Saving order…</span>}
          </div>
          <Link
            href="/admin/assessments/new"
            className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] transition-colors"
          >
            + New Assessment
          </Link>
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
                  <th className="px-2 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Questions</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assessments.map((a, idx) => (
                  <tr
                    key={a.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDrop={() => onDrop(idx)}
                    onDragEnd={() => setDragOver(null)}
                    className={`transition-colors ${dragOver === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-2 py-3 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                        <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
                        <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
                        <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
                      </svg>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.accent_color }} />
                        <span className="text-gray-900 font-medium">{a.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{a.type_label}</td>
                    <td className="px-4 py-3 text-gray-500">{a.questions?.length ?? 0}</td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-4">
                      <button
                        onClick={() => handleDuplicate(a)}
                        disabled={duplicating === a.id}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                      >
                        {duplicating === a.id ? 'Copying…' : 'Duplicate'}
                      </button>
                      <Link href={`/admin/assessments/${a.id}`} className="text-xs text-blue-600 hover:underline">
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
