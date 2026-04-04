'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Assessment {
  id: string;
  title: string;
  type_label: string;
}

interface Bundle {
  id: string;
  title: string;
  description: string | null;
  accent_color: string;
  badge_bg: string;
  badge_text: string;
  bundle_assessments: { assessment_id: string }[];
}

interface CodeFormProps {
  codeId?: string;
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
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [allBundles, setAllBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/assessments')
      .then(r => r.json())
      .then((data: Assessment[]) => setAllAssessments(data));
    fetch('/api/admin/bundles')
      .then(r => r.json())
      .then((data: Bundle[]) => setAllBundles(Array.isArray(data) ? data : []));
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
        setSelectedIds(
          sorted
            .filter((ca: { assessment_id: string | null }) => ca.assessment_id)
            .map((ca: { assessment_id: string }) => ca.assessment_id)
        );
        setSelectedBundleIds(
          sorted
            .filter((ca: { bundle_id: string | null }) => ca.bundle_id)
            .map((ca: { bundle_id: string }) => ca.bundle_id)
        );
        setLoading(false);
      });
  }, [codeId]);

  // Compute which assessment IDs are already covered by selected bundles
  const bundleCoverage = new Map<string, string>(); // assessmentId -> bundle title
  for (const bundle of allBundles) {
    if (selectedBundleIds.includes(bundle.id)) {
      for (const ba of bundle.bundle_assessments ?? []) {
        bundleCoverage.set(ba.assessment_id, bundle.title);
      }
    }
  }

  function toggleAssessment(id: string) {
    if (bundleCoverage.has(id)) return; // blocked — already in a bundle
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  function toggleBundle(id: string) {
    setSelectedBundleIds(prev =>
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
      bundle_ids: selectedBundleIds,
      assessment_ids: selectedIds.filter(id => !bundleCoverage.has(id)),
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
    <form id="code-form" onSubmit={handleSubmit} className="space-y-5 max-w-lg">
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

      {allBundles.length > 0 && (
        <Field label="Bundles">
          <div className="space-y-2">
            {allBundles.map(b => (
              <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBundleIds.includes(b.id)}
                  onChange={() => toggleBundle(b.id)}
                  className="rounded border-gray-300"
                />
                <span
                  className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: b.badge_bg, color: b.badge_text }}
                >
                  {b.title}
                </span>
                {b.description && <span className="text-xs text-gray-400">{b.description}</span>}
              </label>
            ))}
          </div>
        </Field>
      )}

      <Field label="Individual Assessments">
        <div className="space-y-2">
          {allAssessments.map(a => {
            const bundleName = bundleCoverage.get(a.id);
            const isCovered = !!bundleName;
            return (
              <div key={a.id} className="relative group">
                <label className={`flex items-center gap-2 ${isCovered ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={isCovered || selectedIds.includes(a.id)}
                    onChange={() => toggleAssessment(a.id)}
                    disabled={isCovered}
                    className="rounded border-gray-300 disabled:opacity-50"
                  />
                  <span className={`text-sm ${isCovered ? 'text-gray-400' : 'text-gray-700'}`}>{a.title}</span>
                  <span className="text-xs text-gray-400">({a.type_label})</span>
                </label>
                {isCovered && (
                  <div className="absolute left-5 top-full mt-1 z-10 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                    Already included in &ldquo;{bundleName}&rdquo;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      {error && <p className="text-sm text-red-500">{error}</p>}
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
