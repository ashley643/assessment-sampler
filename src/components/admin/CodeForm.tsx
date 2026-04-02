'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Assessment {
  id: string;
  title: string;
  type_label: string;
}

interface CodeFormProps {
  codeId?: string; // undefined = new
}

export default function CodeForm({ codeId }: CodeFormProps) {
  const router = useRouter();
  const isNew = !codeId;

  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/assessments')
      .then(r => r.json())
      .then((data: Assessment[]) => setAllAssessments(data));
  }, []);

  useEffect(() => {
    if (!codeId) return;
    fetch(`/api/admin/codes/${codeId}`)
      .then(r => r.json())
      .then(data => {
        setCode(data.code ?? '');
        setLabel(data.label ?? '');
        setStartsAt(data.starts_at ? data.starts_at.slice(0, 10) : '');
        setExpiresAt(data.expires_at ? data.expires_at.slice(0, 10) : '');
        setIsActive(data.is_active ?? true);
        const sorted = (data.code_assessments ?? []).sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        );
        setSelectedIds(sorted.map((ca: { assessment_id: string }) => ca.assessment_id));
        setLoading(false);
      });
  }, [codeId]);

  function toggleAssessment(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const body = {
      code: code.trim().toUpperCase(),
      label,
      starts_at: startsAt || null,
      expires_at: expiresAt || null,
      is_active: isActive,
      assessment_ids: selectedIds,
    };

    const res = isNew
      ? await fetch('/api/admin/codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch(`/api/admin/codes/${codeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

    if (res.ok) {
      router.push('/admin/codes');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Save failed');
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <Field label="Code">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. DISTRICT2026"
          disabled={!isNew}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        {!isNew && <p className="text-xs text-gray-400 mt-1">Code cannot be changed after creation.</p>}
      </Field>

      <Field label="Label">
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Demo District"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts at (optional)">
          <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Expires at">
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
      </div>

      <Field label="Status">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Active</span>
        </label>
      </Field>

      <Field label="Assessments">
        <div className="space-y-2">
          {allAssessments.map(a => (
            <label key={a.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(a.id)}
                onChange={() => toggleAssessment(a.id)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">{a.title}</span>
              <span className="text-xs text-gray-400">({a.type_label})</span>
            </label>
          ))}
        </div>
        {selectedIds.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">Order reflects selection order above.</p>
        )}
      </Field>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : isNew ? 'Create Code' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/codes')}
          className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
