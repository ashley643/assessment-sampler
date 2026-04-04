'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import ColorPalettePicker from '@/components/admin/ColorPalettePicker';

interface Assessment {
  id: string;
  title: string;
  type_label: string;
  accent_color: string;
}

interface BundleForm {
  id: string;
  title: string;
  description: string;
  accent_color: string;
  badge_bg: string;
  badge_text: string;
  sort_order: number;
}

interface ColorPreset {
  label: string;
  accent_color: string;
  badge_bg: string;
  badge_text: string;
}

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function EditBundlePage() {
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<BundleForm>({
    id: '',
    title: '',
    description: '',
    accent_color: '#4a6fa5',
    badge_bg: '#E6F1FB',
    badge_text: '#0C447C',
    sort_order: 0,
  });
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [colorPresets, setColorPresets] = useState<ColorPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [editingColor, setEditingColor] = useState<string | null>(null); // old accent_color being edited
  const [editingColorForm, setEditingColorForm] = useState<{ accent_color: string; badge_bg: string; badge_text: string } | null>(null);
  const [colorSaving, setColorSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/assessments')
      .then(r => r.json())
      .then(data => setAllAssessments(data.sort((a: Assessment & { sort_order: number }, b: Assessment & { sort_order: number }) => a.sort_order - b.sort_order)));

    // Derive color presets from existing bundles
    fetch('/api/admin/bundles')
      .then(r => r.json())
      .then((data: BundleForm[]) => {
        if (!Array.isArray(data)) return;
        const seen = new Set<string>();
        const presets: ColorPreset[] = [];
        for (const b of data) {
          if (!seen.has(b.accent_color)) {
            seen.add(b.accent_color);
            presets.push({ label: b.title, accent_color: b.accent_color, badge_bg: b.badge_bg, badge_text: b.badge_text });
          }
        }
        setColorPresets(presets);
      });

    if (!isNew) {
      fetch(`/api/admin/bundles/${id}`)
        .then(r => r.json())
        .then(data => {
          setForm({
            id: data.id,
            title: data.title,
            description: data.description ?? '',
            accent_color: data.accent_color,
            badge_bg: data.badge_bg,
            badge_text: data.badge_text,
            sort_order: data.sort_order,
          });
          setSelectedPreset(data.accent_color);
          const sorted = [...(data.bundle_assessments ?? [])].sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
          setSelectedIds(sorted.map((ba: { assessment_id: string }) => ba.assessment_id));
        });
    }
  }, [id, isNew]);

  function set(field: keyof BundleForm, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function startEditColor(preset: ColorPreset) {
    setEditingColor(preset.accent_color);
    setEditingColorForm({ accent_color: preset.accent_color, badge_bg: preset.badge_bg, badge_text: preset.badge_text });
  }

  function cancelEditColor() {
    setEditingColor(null);
    setEditingColorForm(null);
  }

  async function saveColorEdit() {
    if (!editingColor || !editingColorForm) return;
    setColorSaving(true);
    const res = await fetch('/api/admin/bundles/bulk-color', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_accent_color: editingColor, ...editingColorForm }),
    });
    setColorSaving(false);
    if (!res.ok) return;
    setColorPresets(prev => prev.map(p =>
      p.accent_color === editingColor ? { ...p, ...editingColorForm } : p
    ));
    if (selectedPreset === editingColor) {
      setSelectedPreset(editingColorForm.accent_color);
      setForm(f => ({ ...f, ...editingColorForm }));
    }
    setEditingColor(null);
    setEditingColorForm(null);
  }

  function toggleAssessment(aid: string) {
    setSelectedIds(ids =>
      ids.includes(aid) ? ids.filter(i => i !== aid) : [...ids, aid],
    );
  }

  function moveUp(aid: string) {
    setSelectedIds(ids => {
      const idx = ids.indexOf(aid);
      if (idx <= 0) return ids;
      const next = [...ids];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(aid: string) {
    setSelectedIds(ids => {
      const idx = ids.indexOf(aid);
      if (idx >= ids.length - 1) return ids;
      const next = [...ids];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!isNew && !form.id.trim()) { setError('ID is required'); return; }
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      id: isNew ? `bundle-${Date.now()}` : form.id,
      assessment_ids: selectedIds,
    };

    const res = await fetch(
      isNew ? '/api/admin/bundles' : `/api/admin/bundles/${form.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to save');
      setSaving(false);
      return;
    }

    router.push('/admin/bundles');
  }

  const selectedAssessments = selectedIds
    .map(id => allAssessments.find(a => a.id === id))
    .filter(Boolean) as Assessment[];

  const unselected = allAssessments.filter(a => !selectedIds.includes(a.id));

  return (
    <AdminShell>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/bundles')} className="text-sm text-gray-400 hover:text-gray-600">← Bundles</button>
            <h1 className="text-2xl font-semibold text-gray-900">{isNew ? 'New Bundle' : 'Edit Bundle'}</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/admin/bundles')} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-6">
          {/* Basic info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bundle Name</label>
              <input className={INPUT} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Behavioral Health Screener" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input className={INPUT} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description shown to users" />
            </div>
          </div>

          {/* Colors */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Colors</h2>
            {colorPresets.length > 0 && (
              <>
                <p className="text-xs text-gray-500">Pick from an existing color scheme or customize.</p>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map(preset => (
                    <div
                      key={preset.accent_color}
                      className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        selectedPreset === preset.accent_color
                          ? 'border-[#4a6fa5] bg-blue-50 ring-1 ring-[#4a6fa5]'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset.accent_color);
                          setForm(f => ({ ...f, accent_color: preset.accent_color, badge_bg: preset.badge_bg, badge_text: preset.badge_text }));
                        }}
                        className="flex items-center gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: preset.accent_color }} />
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: preset.badge_bg, color: preset.badge_text }}>{preset.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditColor(preset)}
                        title="Edit color scheme"
                        className="ml-1 p-0.5 text-gray-400 hover:text-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedPreset('custom')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      selectedPreset === 'custom'
                        ? 'border-[#4a6fa5] bg-blue-50 ring-1 ring-[#4a6fa5] text-[#4a6fa5] font-medium'
                        : 'border-dashed border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    Custom…
                  </button>
                </div>
              </>
            )}
            {/* Inline color edit panel */}
            {editingColor && editingColorForm && (
              <div className="pt-3 border-t border-gray-100 space-y-4">
                <p className="text-xs font-medium text-gray-500">Editing color scheme — changes apply to all bundles using this color</p>
                <ColorPalettePicker
                  values={editingColorForm}
                  onChange={v => setEditingColorForm(prev => prev ? { ...prev, ...v } : prev)}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={saveColorEdit} disabled={colorSaving} className="px-3 py-1.5 bg-[#4a6fa5] text-white text-xs font-medium rounded-lg hover:bg-[#3d5d8f] disabled:opacity-50">
                    {colorSaving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" onClick={cancelEditColor} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(selectedPreset === 'custom' || colorPresets.length === 0) && !editingColor && (
              <div className="pt-3 border-t border-gray-100">
                <ColorPalettePicker
                  values={{ accent_color: form.accent_color, badge_bg: form.badge_bg, badge_text: form.badge_text }}
                  onChange={v => setForm(f => ({ ...f, ...v }))}
                />
              </div>
            )}
          </div>

          {/* Assessment membership */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Assessments in this Bundle</h2>
            <p className="text-xs text-gray-400">These will appear as cards on the selector screen. Order matters.</p>

            {selectedAssessments.length > 0 && (
              <div className="space-y-2">
                {selectedAssessments.map((a, idx) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.accent_color }} />
                    <span className="flex-1 text-sm font-medium text-gray-800">{a.title}</span>
                    <span className="text-xs text-gray-400">{a.type_label}</span>
                    <button onClick={() => moveUp(a.id)} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs px-1">↑</button>
                    <button onClick={() => moveDown(a.id)} disabled={idx === selectedAssessments.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs px-1">↓</button>
                    <button onClick={() => toggleAssessment(a.id)} className="text-red-400 hover:text-red-600 text-xs ml-1">Remove</button>
                  </div>
                ))}
              </div>
            )}

            {unselected.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 font-medium mt-2">Add assessments:</p>
                {unselected.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toggleAssessment(a.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.accent_color }} />
                    <span className="flex-1 text-sm text-gray-600">{a.title}</span>
                    <span className="text-xs text-gray-400">{a.type_label}</span>
                    <span className="text-xs text-blue-500 font-medium">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </AdminShell>
  );
}
