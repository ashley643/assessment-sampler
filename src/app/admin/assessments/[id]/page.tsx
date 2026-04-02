'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

interface Question {
  id: string;
  sort_order: number;
  title: string;
  embed_url: string;
  spanish_embed_url: string;
  text_embed_url: string;
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
  sort_order: number;
  questions: Question[];
}

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function EditAssessmentPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [form, setForm] = useState<Omit<Assessment, 'questions'> | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/assessments/${id}`)
      .then(r => r.json())
      .then((data: Assessment) => {
        const { questions: qs, ...rest } = data;
        setForm(rest);
        setQuestions(qs.sort((a, b) => a.sort_order - b.sort_order));
      });
  }, [id]);

  function updateForm(key: keyof Omit<Assessment, 'questions'>, value: string | number) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function updateQuestion(idx: number, key: keyof Question, value: string) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [key]: value } : q));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');

    const res = await fetch(`/api/admin/assessments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        questions: questions.map((q, i) => ({ ...q, sort_order: i + 1 })),
      }),
    });

    if (res.ok) {
      router.push('/admin/assessments');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Save failed');
      setSaving(false);
    }
  }

  if (!form) return (
    <AdminShell>
      <p className="text-sm text-gray-400">Loading…</p>
    </AdminShell>
  );

  return (
    <AdminShell>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit Assessment</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <Section title="Details">
            <div className="grid grid-cols-2 gap-4">
              <F label="Title">
                <input value={form.title} onChange={e => updateForm('title', e.target.value)} className={INPUT} required />
              </F>
              <F label="Type ID">
                <input value={form.type} onChange={e => updateForm('type', e.target.value)} className={INPUT} required />
              </F>
              <F label="Type Label">
                <input value={form.type_label} onChange={e => updateForm('type_label', e.target.value)} className={INPUT} required />
              </F>
              <F label="Sort Order">
                <input type="number" value={form.sort_order} onChange={e => updateForm('sort_order', Number(e.target.value))} className={INPUT} />
              </F>
            </div>
            <F label="Description">
              <textarea
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                rows={3}
                className={INPUT}
              />
            </F>
          </Section>

          {/* Colors */}
          <Section title="Colors">
            <div className="grid grid-cols-3 gap-4">
              <F label="Accent Color">
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.accent_color} onChange={e => updateForm('accent_color', e.target.value)} className="h-9 w-12 p-0.5 border border-gray-300 rounded-lg cursor-pointer" />
                  <input value={form.accent_color} onChange={e => updateForm('accent_color', e.target.value)} className={INPUT} />
                </div>
              </F>
              <F label="Badge Background">
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.badge_bg} onChange={e => updateForm('badge_bg', e.target.value)} className="h-9 w-12 p-0.5 border border-gray-300 rounded-lg cursor-pointer" />
                  <input value={form.badge_bg} onChange={e => updateForm('badge_bg', e.target.value)} className={INPUT} />
                </div>
              </F>
              <F label="Badge Text Color">
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.badge_text} onChange={e => updateForm('badge_text', e.target.value)} className="h-9 w-12 p-0.5 border border-gray-300 rounded-lg cursor-pointer" />
                  <input value={form.badge_text} onChange={e => updateForm('badge_text', e.target.value)} className={INPUT} />
                </div>
              </F>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Preview:</span>
              <span
                className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                style={{ background: form.badge_bg, color: form.badge_text }}
              >
                {form.type_label}
              </span>
            </div>
          </Section>

          {/* Questions */}
          <Section title="Questions">
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Question {i + 1}</span>
                  </div>
                  <F label="Title">
                    <input value={q.title} onChange={e => updateQuestion(i, 'title', e.target.value)} className={INPUT} required />
                  </F>
                  <F label="Embed URL">
                    <input value={q.embed_url} onChange={e => updateQuestion(i, 'embed_url', e.target.value)} className={INPUT} required />
                  </F>
                  <F label="Spanish Embed URL (optional)">
                    <input value={q.spanish_embed_url ?? ''} onChange={e => updateQuestion(i, 'spanish_embed_url', e.target.value)} className={INPUT} />
                  </F>
                  <F label="Text Embed URL (optional)">
                    <input value={q.text_embed_url ?? ''} onChange={e => updateQuestion(i, 'text_embed_url', e.target.value)} className={INPUT} />
                  </F>
                </div>
              ))}
            </div>
          </Section>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#4a6fa5] text-white text-sm font-medium rounded-lg hover:bg-[#3d5d8f] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/assessments')}
              className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
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

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
