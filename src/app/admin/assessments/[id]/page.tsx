'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import ColorPalettePicker from '@/components/admin/ColorPalettePicker';

interface Question {
  id: string;
  sort_order: number;
  title: string;
  embed_url: string;
  spanish_embed_url: string;
}

interface Assessment {
  id: string;
  title: string;
  type: string;
  type_label: string;
  accent_color: string;
  badge_bg: string;
  badge_text: string;
  description: string;
  player_label: string;
  sort_order: number;
  questions: Question[];
}

interface TypePreset {
  type: string;
  type_label: string;
  accent_color: string;
  badge_bg: string;
  badge_text: string;
}

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function newQuestion(order: number): Question {
  return { id: `q-${Date.now()}-${order}`, sort_order: order, title: '', embed_url: '', spanish_embed_url: '' };
}

export default function EditAssessmentPage() {
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<Omit<Assessment, 'questions'>>({
    id: '', title: '', type: '', type_label: '',
    accent_color: '#4a6fa5', badge_bg: '#E6F1FB', badge_text: '#0C447C',
    description: '', player_label: '', sort_order: 0,
  });
  const [questions, setQuestions] = useState<Question[]>([newQuestion(1)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [typePresets, setTypePresets] = useState<TypePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | 'custom'>('');

  useEffect(() => {
    // Derive unique type presets from existing assessments
    fetch('/api/admin/assessments')
      .then(r => r.json())
      .then((data: Assessment[]) => {
        const seen = new Set<string>();
        const presets: TypePreset[] = [];
        for (const a of data) {
          if (!seen.has(a.type)) {
            seen.add(a.type);
            presets.push({ type: a.type, type_label: a.type_label, accent_color: a.accent_color, badge_bg: a.badge_bg, badge_text: a.badge_text });
          }
        }
        setTypePresets(presets);
      });
  }, []);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/assessments/${id}`)
      .then(r => r.json())
      .then((data: Assessment) => {
        const { questions: qs, ...rest } = data;
        setForm(rest);
        setQuestions(qs.sort((a, b) => a.sort_order - b.sort_order));
        setSelectedPreset(rest.type);
      });
  }, [id, isNew]);

  function updateForm(key: keyof Omit<Assessment, 'questions'>, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: TypePreset) {
    setSelectedPreset(preset.type);
    setForm(prev => ({
      ...prev,
      type: preset.type,
      type_label: preset.type_label,
      accent_color: preset.accent_color,
      badge_bg: preset.badge_bg,
      badge_text: preset.badge_text,
    }));
  }

  function selectCustom() {
    setSelectedPreset('custom');
    setForm(prev => ({ ...prev, type: '', type_label: '', accent_color: '#4a6fa5', badge_bg: '#E6F1FB', badge_text: '#0C447C' }));
  }

  function updateQuestion(idx: number, key: keyof Question, value: string) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [key]: value } : q));
  }

  function addQuestion() {
    setQuestions(prev => [...prev, newQuestion(prev.length + 1)]);
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form, questions: questions.map((q, i) => ({ ...q, sort_order: i + 1 })) };
    const res = isNew
      ? await fetch('/api/admin/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch(`/api/admin/assessments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      router.push('/admin/assessments');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Save failed');
      setSaving(false);
    }
  }

  const isCustom = selectedPreset === 'custom';

  return (
    <AdminShell>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{isNew ? 'New Assessment' : 'Edit Assessment'}</h1>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.push('/admin/assessments')} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" form="assessment-form" disabled={saving} className="px-4 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
        <form id="assessment-form" onSubmit={handleSubmit} className="space-y-6">

          {/* Details */}
          <Section title="Details">
            <div className="grid grid-cols-2 gap-4">
              {isNew && (
                <F label="ID (slug, no spaces)">
                  <input value={form.id} onChange={e => updateForm('id', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. bhs-3" className={INPUT} required />
                </F>
              )}
              <F label="Title">
                <input value={form.title} onChange={e => updateForm('title', e.target.value)} className={INPUT} required />
              </F>
            </div>
            <F label="Description" hint="Shown on the assessment card">
              <textarea value={form.description} onChange={e => updateForm('description', e.target.value)} rows={3} className={INPUT} />
            </F>
            <F label="Player Label (optional)" hint="Short label shown in the bundle switcher sidebar — leave blank to use description">
              <input value={form.player_label} onChange={e => updateForm('player_label', e.target.value)} placeholder="e.g. Grades 3–4" className={INPUT} />
            </F>
          </Section>

          {/* Type + Colors combined as preset picker */}
          <Section title="Type & Colors">
            <p className="text-xs text-gray-500 mb-3">Select an existing type to inherit its label and colors, or add a new one.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {typePresets.map(preset => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    selectedPreset === preset.type
                      ? 'border-[#4a6fa5] bg-blue-50 ring-1 ring-[#4a6fa5]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: preset.accent_color }} />
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: preset.badge_bg, color: preset.badge_text }}
                  >
                    {preset.type_label}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={selectCustom}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  isCustom
                    ? 'border-[#4a6fa5] bg-blue-50 ring-1 ring-[#4a6fa5] text-[#4a6fa5] font-medium'
                    : 'border-dashed border-gray-300 text-gray-500 hover:border-gray-400'
                }`}
              >
                + New type…
              </button>
            </div>

            {/* Custom fields — only shown when "New type" selected */}
            {isCustom && (
              <div className="pt-3 border-t border-gray-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <F label="Type ID (slug)">
                    <input value={form.type} onChange={e => updateForm('type', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. community-schools" className={INPUT} required />
                  </F>
                  <F label="Type Label">
                    <input value={form.type_label} onChange={e => updateForm('type_label', e.target.value)} placeholder="e.g. Community Schools" className={INPUT} required />
                  </F>
                </div>
                <ColorPalettePicker
                  values={{ accent_color: form.accent_color, badge_bg: form.badge_bg, badge_text: form.badge_text }}
                  onChange={v => setForm(prev => ({ ...prev, ...v }))}
                />
              </div>
            )}

            {/* Preview for preset selections */}
            {selectedPreset && selectedPreset !== 'custom' && form.type_label && (
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Preview:</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: form.accent_color }} />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: form.badge_bg, color: form.badge_text }}>
                  {form.type_label}
                </span>
              </div>
            )}
          </Section>

          {/* Questions */}
          <Section title="Questions">
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Question {i + 1}</span>
                    <button type="button" onClick={() => removeQuestion(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                  <F label="Title">
                    <input value={q.title} onChange={e => updateQuestion(i, 'title', e.target.value)} className={INPUT} required />
                  </F>
                  <F label="Embed URL (VideoAsk URL)">
                    <input value={q.embed_url} onChange={e => updateQuestion(i, 'embed_url', e.target.value)} placeholder="https://..." className={INPUT} required />
                  </F>
                  <F label="Spanish Embed URL (optional)">
                    <input value={q.spanish_embed_url ?? ''} onChange={e => updateQuestion(i, 'spanish_embed_url', e.target.value)} placeholder="https://..." className={INPUT} />
                  </F>
                </div>
              ))}
            </div>
            <button type="button" onClick={addQuestion} className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Add Question
            </button>
          </Section>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
