'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import ColorPalettePicker from '@/components/admin/ColorPalettePicker';

interface QuestionSample {
  id: string;
  sort_order: number;
  language: 'english' | 'spanish';
  embed_url: string;
  media_type: '' | 'video' | 'audio';
  gender: string;
  grade: string;
  excerpt: string;
}

const GRADES = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'Parent', 'Staff'];

function GradePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {GRADES.map(g => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(value === g ? '' : g)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
            value === g
              ? 'bg-[#4a6fa5] text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

interface Question {
  id: string;
  sort_order: number;
  title: string;
  question: string;
  embed_url: string;
  spanish_embed_url: string;
  question_samples: QuestionSample[];
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
const INPUT_SM = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400';

function newSample(language: 'english' | 'spanish', order: number): QuestionSample {
  return { id: `s-${Date.now()}-${order}`, sort_order: order, language, embed_url: '', media_type: '', gender: '', grade: '', excerpt: '' };
}

function newQuestion(order: number): Question {
  return {
    id: `q-${Date.now()}-${order}`,
    sort_order: order,
    title: '',
    question: '',
    embed_url: '',
    spanish_embed_url: '',
    question_samples: [newSample('english', 0), newSample('spanish', 1)],
  };
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
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [editingPresetForm, setEditingPresetForm] = useState<TypePreset | null>(null);
  const [presetSaving, setPresetSaving] = useState(false);

  // Excerpt edit state: sampleId → draft text (undefined = not editing)
  const [excerptEditing, setExcerptEditing] = useState<Record<string, string | undefined>>({});
  // Sample drag state
  const dragSample = useRef<{ qIdx: number; sIdx: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // Question drag state
  const dragQuestion = useRef<number | null>(null);
  const [dragOverQIdx, setDragOverQIdx] = useState<number | null>(null);
  // Expanded extra samples per question (beyond first EN + first ES)
  const [samplesExpanded, setSamplesExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
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
        setQuestions(
          qs.sort((a, b) => a.sort_order - b.sort_order).map(q => ({
            ...q,
            question_samples: (q.question_samples ?? []).sort((a, b) => a.sort_order - b.sort_order),
          }))
        );
        setSelectedPreset(rest.type);
      });
  }, [id, isNew]);

  function updateForm(key: keyof Omit<Assessment, 'questions'>, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: TypePreset) {
    setSelectedPreset(preset.type);
    setForm(prev => ({ ...prev, type: preset.type, type_label: preset.type_label, accent_color: preset.accent_color, badge_bg: preset.badge_bg, badge_text: preset.badge_text }));
  }

  function selectCustom() {
    setSelectedPreset('custom');
    setForm(prev => ({ ...prev, type: '', type_label: '', accent_color: '#4a6fa5', badge_bg: '#E6F1FB', badge_text: '#0C447C' }));
  }

  function startEditPreset(preset: TypePreset) {
    setEditingPreset(preset.type);
    setEditingPresetForm({ ...preset });
  }

  function cancelEditPreset() {
    setEditingPreset(null);
    setEditingPresetForm(null);
  }

  async function savePresetEdit() {
    if (!editingPreset || !editingPresetForm) return;
    setPresetSaving(true);
    const res = await fetch(`/api/admin/types/${encodeURIComponent(editingPreset)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPresetForm),
    });
    setPresetSaving(false);
    if (!res.ok) return;
    setTypePresets(prev => prev.map(p => p.type === editingPreset ? { ...editingPresetForm } : p));
    if (selectedPreset === editingPreset) {
      setSelectedPreset(editingPresetForm.type);
      setForm(prev => ({ ...prev, ...editingPresetForm }));
    }
    setEditingPreset(null);
    setEditingPresetForm(null);
  }

  async function deletePreset(preset: TypePreset) {
    if (!confirm(`Delete type "${preset.type_label}"? This will permanently delete all assessments of this type.`)) return;
    const res = await fetch(`/api/admin/types/${encodeURIComponent(preset.type)}`, { method: 'DELETE' });
    if (!res.ok) return;
    setTypePresets(prev => prev.filter(p => p.type !== preset.type));
    if (selectedPreset === preset.type) {
      setSelectedPreset('');
      setForm(prev => ({ ...prev, type: '', type_label: '', accent_color: '#4a6fa5', badge_bg: '#E6F1FB', badge_text: '#0C447C' }));
    }
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

  function updateSample(qIdx: number, sIdx: number, key: keyof QuestionSample, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, question_samples: q.question_samples.map((s, j) => j === sIdx ? { ...s, [key]: value } : s) };
    }));
  }

  function addSample(qIdx: number, language: 'english' | 'spanish') {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const s = newSample(language, q.question_samples.length);
      // Auto-open excerpt editing for the new sample
      setExcerptEditing(ed => ({ ...ed, [s.id]: '' }));
      return { ...q, question_samples: [...q.question_samples, s] };
    }));
  }

  function removeSample(qIdx: number, sIdx: number) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, question_samples: q.question_samples.filter((_, j) => j !== sIdx) };
    }));
  }

  // Drag handlers
  function onDragStart(qIdx: number, sIdx: number) {
    dragSample.current = { qIdx, sIdx };
  }

  function onDragOver(e: React.DragEvent, key: string) {
    e.preventDefault();
    setDragOverKey(key);
  }

  function onDrop(qIdx: number, sIdx: number) {
    const from = dragSample.current;
    if (!from || from.qIdx !== qIdx || from.sIdx === sIdx) { dragSample.current = null; setDragOverKey(null); return; }
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const samples = [...q.question_samples];
      const [moved] = samples.splice(from.sIdx, 1);
      samples.splice(sIdx, 0, moved);
      return { ...q, question_samples: samples };
    }));
    dragSample.current = null;
    setDragOverKey(null);
  }

  function onDragEnd() {
    dragSample.current = null;
    setDragOverKey(null);
  }

  // Question drag handlers
  function onQuestionDragStart(qi: number) {
    dragQuestion.current = qi;
  }

  function onQuestionDragOver(e: React.DragEvent, qi: number) {
    e.preventDefault();
    if (dragQuestion.current !== null && dragQuestion.current !== qi) setDragOverQIdx(qi);
  }

  function onQuestionDrop(qi: number) {
    const from = dragQuestion.current;
    if (from === null || from === qi) { dragQuestion.current = null; setDragOverQIdx(null); return; }
    setQuestions(prev => {
      const qs = [...prev];
      const [moved] = qs.splice(from, 1);
      qs.splice(qi, 0, moved);
      return qs;
    });
    dragQuestion.current = null;
    setDragOverQIdx(null);
  }

  function onQuestionDragEnd() {
    dragQuestion.current = null;
    setDragOverQIdx(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      questions: questions.map((q, i) => ({
        ...q,
        sort_order: i + 1,
        question_samples: q.question_samples.map((s, j) => ({ ...s, sort_order: j })),
      })),
    };
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
            <F label="Player Label (optional)" hint="Short label shown in the bundle version switcher — leave blank to use description">
              <div className="relative">
                <input
                  value={form.player_label}
                  onChange={e => updateForm('player_label', e.target.value.slice(0, 32))}
                  placeholder="e.g. Grades 3–4"
                  maxLength={32}
                  className={INPUT}
                />
                <span className={`absolute right-2 bottom-2 text-xs ${(form.player_label ?? '').length >= 28 ? 'text-amber-500' : 'text-gray-300'}`}>
                  {(form.player_label ?? '').length}/32
                </span>
              </div>
            </F>
          </Section>

          <Section title="Type & Colors">
            <p className="text-xs text-gray-500 mb-3">Select an existing type to inherit its label and colors, or add a new one.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {typePresets.map(preset => (
                <div
                  key={preset.type}
                  className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    selectedPreset === preset.type
                      ? 'border-[#4a6fa5] bg-blue-50 ring-1 ring-[#4a6fa5]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <button type="button" onClick={() => applyPreset(preset)} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: preset.accent_color }} />
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: preset.badge_bg, color: preset.badge_text }}>{preset.type_label}</span>
                  </button>
                  <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => startEditPreset(preset)} title="Edit type" className="p-0.5 text-gray-400 hover:text-gray-700 rounded">
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z"/></svg>
                    </button>
                    <button type="button" onClick={() => deletePreset(preset)} title="Delete type" className="p-0.5 text-gray-400 hover:text-red-500 rounded">
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M6 4V2h4v2M5 4v9h6V4"/></svg>
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={selectCustom}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${isCustom ? 'border-[#4a6fa5] bg-blue-50 ring-1 ring-[#4a6fa5] text-[#4a6fa5] font-medium' : 'border-dashed border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                + New type…
              </button>
            </div>

            {editingPreset && editingPresetForm && (
              <div className="pt-3 border-t border-gray-100 space-y-4">
                <p className="text-xs font-medium text-gray-500">Editing type — changes apply to all assessments of this type</p>
                <div className="grid grid-cols-2 gap-4">
                  <F label="Type ID (slug)">
                    <input value={editingPresetForm.type} onChange={e => setEditingPresetForm(prev => prev ? { ...prev, type: e.target.value.toLowerCase().replace(/\s+/g, '-') } : prev)} className={INPUT} />
                  </F>
                  <F label="Type Label">
                    <input value={editingPresetForm.type_label} onChange={e => setEditingPresetForm(prev => prev ? { ...prev, type_label: e.target.value } : prev)} className={INPUT} />
                  </F>
                </div>
                <ColorPalettePicker
                  values={{ accent_color: editingPresetForm.accent_color, badge_bg: editingPresetForm.badge_bg, badge_text: editingPresetForm.badge_text }}
                  onChange={v => setEditingPresetForm(prev => prev ? { ...prev, ...v } : prev)}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={savePresetEdit} disabled={presetSaving} className="px-3 py-1.5 bg-[#4a6fa5] text-white text-xs font-medium rounded-lg hover:bg-[#3d5d8f] disabled:opacity-50">
                    {presetSaving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" onClick={cancelEditPreset} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}

            {isCustom && !editingPreset && (
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

            {selectedPreset && selectedPreset !== 'custom' && form.type_label && !editingPreset && (
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Preview:</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: form.accent_color }} />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: form.badge_bg, color: form.badge_text }}>{form.type_label}</span>
              </div>
            )}
          </Section>

          <Section title="Questions">
            <div className="space-y-6">
              {questions.map((q, qi) => (
                <div
                  key={q.id}
                  onDragOver={e => onQuestionDragOver(e, qi)}
                  onDrop={() => onQuestionDrop(qi)}
                  onDragEnd={onQuestionDragEnd}
                  className={`border rounded-xl p-4 space-y-4 transition-all ${dragOverQIdx === qi ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center gap-2">
                    {/* Question drag handle */}
                    <span
                      draggable
                      onDragStart={() => onQuestionDragStart(qi)}
                      className="flex-shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing select-none"
                      title="Drag to reorder"
                    >
                      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                        <circle cx="3.5" cy="3.5" r="1.5"/><circle cx="8.5" cy="3.5" r="1.5"/>
                        <circle cx="3.5" cy="8" r="1.5"/><circle cx="8.5" cy="8" r="1.5"/>
                        <circle cx="3.5" cy="12.5" r="1.5"/><circle cx="8.5" cy="12.5" r="1.5"/>
                      </svg>
                    </span>
                    <span className="text-xs font-semibold text-gray-500 flex-1">Question {qi + 1}</span>
                    <button type="button" onClick={() => removeQuestion(qi)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                  <F label="Title">
                    <input value={q.title} onChange={e => updateQuestion(qi, 'title', e.target.value)} className={INPUT} required />
                  </F>
                  <F label="Question">
                    <textarea value={q.question ?? ''} onChange={e => updateQuestion(qi, 'question', e.target.value)} rows={2} className={INPUT} placeholder="e.g. How do you see yourself as a learner?" />
                  </F>
                  <F label="Embed URL">
                    <input value={q.embed_url} onChange={e => updateQuestion(qi, 'embed_url', e.target.value)} placeholder="https://..." className={INPUT} required />
                  </F>
                  <F label="Spanish Embed URL (optional)">
                    <input value={q.spanish_embed_url ?? ''} onChange={e => updateQuestion(qi, 'spanish_embed_url', e.target.value)} placeholder="https://..." className={INPUT} />
                  </F>

                  {/* Sample responses */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-500">Sample Responses</p>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Drag to reorder. The <span className="font-medium text-green-700">first English and first Spanish</span> show in the assessment player; additional samples go to the feed only.
                    </p>
                    {(() => {
                      const isExpanded = samplesExpanded.has(qi);
                      // Always show the first EN and first ES; hide the rest unless expanded
                      const firstEnIdx = q.question_samples.findIndex(s => s.language === 'english');
                      const firstEsIdx = q.question_samples.findIndex(s => s.language === 'spanish');
                      const defaultVisible = new Set([firstEnIdx, firstEsIdx].filter(i => i !== -1));
                      const extraCount = q.question_samples.filter((_, i) => !defaultVisible.has(i)).length;
                      const visibleSamples = isExpanded
                        ? q.question_samples.map((s, si) => ({ s, si }))
                        : q.question_samples.map((s, si) => ({ s, si })).filter(({ si }) => defaultVisible.has(si));
                      return (
                    <div className="space-y-1.5">
                      {visibleSamples.map(({ s, si }) => {
                        const sampleKey = `${qi}-${si}`;
                        const isDragOver = dragOverKey === sampleKey;
                        const isFirst = q.question_samples.findIndex(x => x.language === s.language) === si;
                        const isEditingExcerpt = s.id in excerptEditing;
                        const excerptDraft = excerptEditing[s.id] ?? s.excerpt;

                        return (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={() => onDragStart(qi, si)}
                            onDragOver={e => onDragOver(e, sampleKey)}
                            onDrop={() => onDrop(qi, si)}
                            onDragEnd={onDragEnd}
                            className={`rounded-lg border transition-all ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
                          >
                            {/* Row header */}
                            <div className="flex items-center gap-2 px-2.5 py-2">
                              {/* Drag handle */}
                              <span className="flex-shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing select-none">
                                <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                                  <circle cx="3.5" cy="3.5" r="1.5"/><circle cx="8.5" cy="3.5" r="1.5"/>
                                  <circle cx="3.5" cy="8" r="1.5"/><circle cx="8.5" cy="8" r="1.5"/>
                                  <circle cx="3.5" cy="12.5" r="1.5"/><circle cx="8.5" cy="12.5" r="1.5"/>
                                </svg>
                              </span>

                              {/* Language badge */}
                              <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${s.language === 'english' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {s.language === 'english' ? 'EN' : 'ES'}
                              </span>

                              {/* Placement badge */}
                              {isFirst
                                ? <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Player + Feed</span>
                                : <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Feed only</span>
                              }

                              <div className="flex-1" />

                              {/* Remove */}
                              <button type="button" onClick={() => removeSample(qi, si)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors p-0.5" title="Remove">
                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2l10 10M12 2L2 12"/></svg>
                              </button>
                            </div>

                            {/* Fields */}
                            <div className="px-2.5 pb-2.5 space-y-1.5">
                              <input value={s.embed_url} onChange={e => updateSample(qi, si, 'embed_url', e.target.value)} placeholder="VideoAsk share URL…" className={INPUT_SM} />
                              <div className="grid grid-cols-2 gap-1.5">
                                <select value={s.media_type} onChange={e => updateSample(qi, si, 'media_type', e.target.value)} className={INPUT_SM}>
                                  <option value="">Media type (optional)</option>
                                  <option value="video">Video</option>
                                  <option value="audio">Audio</option>
                                </select>
                                <select value={s.gender} onChange={e => updateSample(qi, si, 'gender', e.target.value)} className={INPUT_SM}>
                                  <option value="">Gender (optional)</option>
                                  <option value="M">M</option>
                                  <option value="F">F</option>
                                </select>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 mb-1">Grade / Role (optional)</p>
                                <GradePicker value={s.grade} onChange={v => updateSample(qi, si, 'grade', v)} />
                              </div>

                              {/* Excerpt — collapsed or editing */}
                              {isEditingExcerpt ? (
                                <div className="space-y-1.5">
                                  <textarea
                                    value={excerptDraft}
                                    onChange={e => setExcerptEditing(ed => ({ ...ed, [s.id]: e.target.value }))}
                                    placeholder="A short quote from the response…"
                                    rows={4}
                                    className={INPUT_SM + ' resize-none'}
                                    autoFocus
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateSample(qi, si, 'excerpt', excerptDraft ?? '');
                                        setExcerptEditing(ed => { const next = { ...ed }; delete next[s.id]; return next; });
                                      }}
                                      className="px-2.5 py-1 bg-[#4a6fa5] text-white text-xs font-medium rounded-lg hover:bg-[#3d5d8f] transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setExcerptEditing(ed => { const next = { ...ed }; delete next[s.id]; return next; })}
                                      className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setExcerptEditing(ed => ({ ...ed, [s.id]: s.excerpt }))}
                                  className="w-full text-left"
                                >
                                  {s.excerpt
                                    ? <p className="text-xs italic text-gray-500 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors leading-relaxed">&ldquo;{s.excerpt}&rdquo;</p>
                                    : <p className="text-xs text-gray-300 hover:text-gray-400 px-2.5 py-1 transition-colors">+ Add excerpt…</p>
                                  }
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                      );
                    })()}
                    {/* Load more / collapse extra samples */}
                    {(() => {
                      const firstEnIdx = q.question_samples.findIndex(s => s.language === 'english');
                      const firstEsIdx = q.question_samples.findIndex(s => s.language === 'spanish');
                      const defaultVisible = new Set([firstEnIdx, firstEsIdx].filter(i => i !== -1));
                      const extraCount = q.question_samples.filter((_, i) => !defaultVisible.has(i)).length;
                      const isExpanded = samplesExpanded.has(qi);
                      if (extraCount === 0) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setSamplesExpanded(prev => { const n = new Set(prev); isExpanded ? n.delete(qi) : n.add(qi); return n; })}
                          className="mt-1.5 w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
                        >
                          {isExpanded ? `▲ Hide extra samples` : `▼ Show ${extraCount} more sample${extraCount !== 1 ? 's' : ''}`}
                        </button>
                      );
                    })()}
                    <div className="flex gap-2 mt-2.5">
                      <button type="button" onClick={() => { addSample(qi, 'english'); setSamplesExpanded(prev => new Set([...prev, qi])); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                        + English sample
                      </button>
                      <button type="button" onClick={() => { addSample(qi, 'spanish'); setSamplesExpanded(prev => new Set([...prev, qi])); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
                        + Spanish sample
                      </button>
                    </div>
                  </div>
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
