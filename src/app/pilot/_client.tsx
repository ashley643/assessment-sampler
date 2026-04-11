'use client';

import { useState, useRef } from 'react';

// ── Sample CSV data ──────────────────────────────────────────────────────────
const CSV_COLS = [
  'Timestamp', 'School', 'Grade', 'Gender', 'Ethnicity',
  'Q1 Response', 'Q1 Time',
  'Q2 Response', 'Q2 Time',
  'Q3 Response', 'Q3 Time',
  'Score (200–800)', 'Language Style', 'Community Signal', 'Unmet Need', 'Next Step',
];

const CSV_ROWS = [
  ['10/3/2024 9:14', 'Riverside Elem.', '5th', 'Female', 'Latinx',
    'I care most about my family. My mom works two jobs and I want to make her proud one day…', '1m 42s',
    'It was hard when I switched schools. I cried a lot but I kept going even when I wanted to quit…', '2m 05s',
    'I need more time to ask questions. I always feel like I\'m behind and rushing to keep up.', '1m 18s',
    '512', 'Reflective, future-oriented', 'Strong family connection; high belonging', 'Academic pacing support', 'Teacher check-in'],
  ['10/3/2024 9:22', 'Riverside Elem.', '5th', 'Male', 'Black or African American',
    'I care about being a good friend. I want people to know they can count on me when things get hard…', '1m 29s',
    'My grandpa passed away. I was really sad but I started talking to my teacher and that helped a lot…', '1m 55s',
    'I need more time to just breathe. I feel stressed about tests a lot of the time.', '0m 58s',
    '478', 'Grounded, interpersonal', 'Peer support-seeking; relational awareness', 'Emotional regulation support', 'Counselor check-in'],
  ['10/3/2024 10:01', 'Washington Middle', '7th', 'Female', 'White',
    'I care about the environment. I\'ve been learning about climate change and it worries me…', '2m 11s',
    'Math was really hard for me. I got tutoring and worked at it, and now I actually enjoy it.', '1m 47s',
    'I\'d love more hands-on projects. I learn so much better when I\'m doing something, not just reading.', '1m 32s',
    '634', 'Analytical, solution-focused', 'High academic confidence; growth mindset', 'Enrichment opportunity', 'Leadership program referral'],
  ['10/3/2024 10:08', 'Washington Middle', '8th', 'Non-binary', 'Latinx',
    'I care about art. I paint and draw. It\'s the only place where I feel like I can say anything.', '2m 33s',
    'People have made fun of the way I look. I still show up every day. I try not to let it stop me.', '1m 59s',
    'I need people to just not judge me. I want to feel safe being myself at school.', '1m 44s',
    '389', 'Expressive, vulnerable', 'Low sense of safety; identity stress', 'Belonging and safety support', 'Immediate counselor outreach'],
  ['10/3/2024 11:15', 'Lincoln High', '10th', 'Male', 'Asian or Pacific Islander',
    'I care about my future and making my parents proud. There is a lot of pressure but also a lot of love…', '1m 38s',
    'Balancing school, sports, and expectations has been really hard. I had to learn to say no sometimes.', '2m 20s',
    'More mental health resources at school would help. Sometimes it\'s hard to find someone to talk to.', '1m 51s',
    '558', 'Accomplished, pressured', 'High drive; potential burnout risk', 'Wellbeing check-in', 'Peer mentorship pairing'],
  ['10/3/2024 11:29', 'Lincoln High', '11th', 'Female', 'Multiracial',
    'I care about justice. I\'ve seen unfair things in my community and I want to be someone who changes it.', '2m 44s',
    'I didn\'t think I was smart enough for AP classes. My counselor pushed me. I\'m doing it now.', '2m 18s',
    'More counselors. There is only one for the whole grade and it\'s not enough.', '1m 22s',
    '601', 'Advocacy-oriented, resilient', 'High civic engagement; strong self-efficacy', 'System-level voice opportunity', 'Student voice program flag'],
];

// ── VideoAsk previews ────────────────────────────────────────────────────────
const PREVIEWS = [
  {
    label: 'Community Schools Parent Survey',
    org: 'San Mateo-Foster City USD',
    url: 'https://smfcsd.impacterpathway.com/f5wvxewbq?preview',
  },
  {
    label: 'Empathy Interview',
    org: 'Vista High School',
    url: 'https://vistahs.impacterpathway.com/fzbfs0rrd?preview',
  },
  {
    label: 'Graduate Portrait Survey',
    org: 'Western Placer USD',
    url: 'https://wpusd.impacterpathway.com/f78d5omaf?preview',
  },
];

// ── Assessment type options ──────────────────────────────────────────────────
const ASSESSMENT_TYPES = [
  {
    id: 'community-schools' as const,
    label: 'Community Schools Survey',
    description: 'Structured voice from students, families, and staff to inform continuous improvement and LCAP planning.',
  },
  {
    id: 'learner-portrait' as const,
    label: 'Learner Portrait',
    description: 'Open-ended voice interviews that surface SEL competencies, strengths, and growth areas for each student.',
  },
  {
    id: 'behavioral-health' as const,
    label: 'Behavioral Health Screener',
    description: 'A validated voice-based approach to identifying students who may benefit from counseling or intervention.',
  },
];

type AssessmentId = 'community-schools' | 'learner-portrait' | 'behavioral-health';

interface FormData {
  assessmentType: AssessmentId | '';
  // Step 2: Dates
  startDate: string;
  endDate: string;
  dateNotes: string;
  onsiteSupport: 'yes' | 'no' | 'unsure' | null;
  // Step 3: Contextual
  respondents: string[];
  gradeLevels: string[];
  expectedCount: string;
  launchTimeline: string;
  // Community Schools specific
  communityModel: string;
  primaryGoal: string;
  // Learner Portrait specific
  competencyFocus: string;
  // Behavioral Health specific
  screeningScope: string;
  // Contact
  name: string;
  email: string;
  role: string;
  organization: string;
  phone: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  assessmentType: '',
  startDate: '',
  endDate: '',
  dateNotes: '',
  onsiteSupport: null,
  respondents: [],
  gradeLevels: [],
  expectedCount: '',
  launchTimeline: '',
  communityModel: '',
  primaryGoal: '',
  competencyFocus: '',
  screeningScope: '',
  name: '',
  email: '',
  role: '',
  organization: '',
  phone: '',
  notes: '',
};

const GRADE_BANDS = ['Lower Elementary (TK–2)', 'Elementary (3rd–5th)', 'Middle School (6th–8th)', 'High School (9th–12th)'];

function MultiCheck({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt]);
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value.includes(opt)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white';
const SELECT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-700';

export default function PilotClient() {
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [previewModal, setPreviewModal] = useState<{ label: string; url: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function set(field: keyof FormData, value: FormData[keyof FormData]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function openForm() {
    setFormOpen(true);
    setStep(1);
    setForm(EMPTY_FORM);
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      setStep(5);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canAdvanceStep1 = !!form.assessmentType;
  const canAdvanceStep2 = !!form.startDate && form.onsiteSupport !== null;
  const studentsSelected = form.respondents.includes('Students');
  const canAdvanceStep3 = form.respondents.length > 0
    && (!studentsSelected || form.gradeLevels.length > 0)
    && !!form.expectedCount
    && !!form.launchTimeline;
  const canAdvanceStep4 = !!form.name && !!form.email && !!form.organization;

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <span className="text-sm font-semibold text-indigo-600 tracking-tight">Impacter Pathway</span>
        <span className="text-gray-200">·</span>
        <span className="text-sm text-gray-500">Pilot Program</span>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-5 tracking-wide uppercase">
          Pilot Program
        </div>
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Hear every student voice.<br />
          <span className="text-indigo-600">Before the school year gets away from you.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          A structured pilot gives you real student, family, and staff voice — scored, organized, and ready for action — in about a week.
        </p>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8 text-center">How a pilot works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              n: '1',
              title: 'Share a link',
              body: 'We configure a custom assessment for your school or district. Respondents click a link and answer 3–5 voice questions — no app download, no login.',
              accent: 'bg-indigo-50 text-indigo-700',
            },
            {
              n: '2',
              title: 'Get your data',
              body: 'Within days you receive a structured CSV with every response, an AI-generated score, language analysis, and a recommended next step for each respondent.',
              accent: 'bg-emerald-50 text-emerald-700',
            },
            {
              n: '3',
              title: 'Receive your report',
              body: 'About a week after the window closes, we deliver a synthesized report with cross-school analytics, theme clusters, and equity breakdowns.',
              accent: 'bg-amber-50 text-amber-700',
            },
          ].map(({ n, title, body, accent }) => (
            <div key={n} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-4 ${accent}`}>{n}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">
          Assessments are available in English and Spanish. Custom and non-custom options available.
        </p>
      </section>

      {/* ── Sample data ──────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-1">Sample output</h2>
            <p className="text-gray-700 font-medium">What the CSV looks like — anonymized example data</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs whitespace-nowrap border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {CSV_COLS.map(col => (
                    <th key={col} className="px-3 py-2.5 text-left font-semibold text-gray-500 border-b border-gray-200 sticky top-0 bg-gray-100">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CSV_ROWS.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-3 py-2 border-b border-gray-100 text-gray-600 ${
                        j === 11 ? 'font-semibold text-indigo-700' :
                        j >= 12 ? 'text-gray-500' : ''
                      }`}>
                        <span className="block max-w-[220px] overflow-hidden text-ellipsis">{cell}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">All data above is synthetic. Real output is delivered as a downloadable CSV.</p>
        </div>
      </section>

      {/* ── See it in action ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-1">See it in action</h2>
          <p className="text-gray-700 font-medium">Real assessments from Impacter Pathway partners</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PREVIEWS.map(({ label, org, url }) => (
            <div key={url} className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.624v6.752a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-0.5">{label}</p>
                <p className="text-xs text-gray-400">{org}</p>
              </div>
              <button
                onClick={() => setPreviewModal({ label, url })}
                className="w-full text-center text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50 transition-colors"
              >
                View Assessment
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Preview modal ────────────────────────────────────────────────────── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewModal(null)}>
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full max-w-4xl" style={{ height: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-900">{previewModal.label}</p>
              </div>
              <button onClick={() => setPreviewModal(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe
              src={previewModal.url}
              className="flex-1 w-full border-0"
              allow="camera; microphone; autoplay"
              title={previewModal.label}
            />
          </div>
        </div>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      {!formOpen && (
        <section className="border-t border-gray-100 bg-indigo-600 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to run a pilot?</h2>
          <p className="text-indigo-200 mb-8 text-sm max-w-md mx-auto">
            Tell us a bit about your school or district and we will set everything up — typically within a few days.
          </p>
          <button
            onClick={openForm}
            className="bg-white text-indigo-700 font-semibold px-8 py-3 rounded-xl text-sm hover:bg-indigo-50 transition-colors shadow"
          >
            Begin
          </button>
        </section>
      )}

      {/* ── Intake Form (full-screen overlay) ────────────────────────────────── */}
      {formOpen && (
        <div ref={formRef} className="fixed inset-0 z-40 bg-white flex flex-col overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-indigo-600">Impacter Pathway</span>
              <span className="text-gray-200">·</span>
              <span className="text-sm text-gray-400">Pilot Intake</span>
            </div>
            <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 py-10">

            {/* Step indicator */}
            {step < 5 && (
              <div className="flex items-center gap-1.5 mb-8">
                {([
                  { n: 1, label: 'Assessment' },
                  { n: 2, label: 'Dates' },
                  { n: 3, label: 'Participants' },
                  { n: 4, label: 'Contact' },
                ] as const).map(({ n, label }) => (
                  <div key={n} className="flex items-center gap-1.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      step === n ? 'bg-indigo-600 text-white' :
                      step > n  ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'
                    }`}>{n}</div>
                    <span className={`text-xs hidden sm:inline ${step === n ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                    {n < 4 && <div className={`h-px w-5 mx-1 transition-colors ${step > n ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* ── Step 1: Assessment type ────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Which assessment fits your needs?</h3>
                  <p className="text-sm text-gray-500 mb-5">Choose the one that best matches your goals for the pilot.</p>
                </div>
                <div className="space-y-3">
                  {ASSESSMENT_TYPES.map(({ id, label, description }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => set('assessmentType', id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                        form.assessmentType === id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-semibold mb-0.5 ${form.assessmentType === id ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-500">{description}</p>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    disabled={!canAdvanceStep1}
                    onClick={() => setStep(2)}
                    className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Dates ─────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">When are you thinking?</h3>
                  <p className="text-sm text-gray-500 mb-1">
                    Give us your best guess — this is just to get a sense of your window.
                    An Impacter team member will follow up to confirm the final dates.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start date" required>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={e => set('startDate', e.target.value)}
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="End date">
                    <input
                      type="date"
                      value={form.endDate}
                      min={form.startDate || undefined}
                      onChange={e => set('endDate', e.target.value)}
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                <Field label="Any important dates or constraints we should know about?">
                  <textarea
                    value={form.dateNotes}
                    onChange={e => set('dateNotes', e.target.value)}
                    placeholder="e.g. Avoid testing windows, spring break Mar 24–28, prefer mornings…"
                    rows={3}
                    className={INPUT_CLS + ' resize-none'}
                  />
                </Field>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Would you like an Impacter team member to support on-site during implementation? *
                  </p>
                  <div className="space-y-2">
                    {([
                      { value: 'yes',    label: 'Yes please — on-site support would be helpful' },
                      { value: 'no',     label: 'No, we will handle implementation independently' },
                      { value: 'unsure', label: 'Not sure yet' },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.onsiteSupport === value
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="onsiteSupport"
                          value={value}
                          checked={form.onsiteSupport === value}
                          onChange={() => set('onsiteSupport', value)}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <button
                    disabled={!canAdvanceStep2}
                    onClick={() => setStep(3)}
                    className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Contextual questions ──────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Tell us about your context</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    This helps us configure the right assessment for you.
                  </p>
                </div>

                <MultiCheck
                  label="Who will be responding? *"
                  options={
                    form.assessmentType === 'learner-portrait'
                      ? ['Students']
                      : form.assessmentType === 'behavioral-health'
                      ? ['Students', 'Staff']
                      : ['Students', 'Families / Parents', 'Staff', 'Community Members']
                  }
                  value={form.respondents}
                  onChange={v => set('respondents', v)}
                />

                {studentsSelected && (
                  <MultiCheck
                    label="Which grade levels? *"
                    options={GRADE_BANDS}
                    value={form.gradeLevels}
                    onChange={v => set('gradeLevels', v)}
                  />
                )}

                <Field label="How many respondents do you anticipate?" required>
                  <select value={form.expectedCount} onChange={e => set('expectedCount', e.target.value)} className={SELECT_CLS}>
                    <option value="">Select a range…</option>
                    <option>Under 50</option>
                    <option>50–150</option>
                    <option>150–500</option>
                    <option>500–1,000</option>
                    <option>Over 1,000</option>
                  </select>
                </Field>

                <Field label="When would you like to launch?" required>
                  <select value={form.launchTimeline} onChange={e => set('launchTimeline', e.target.value)} className={SELECT_CLS}>
                    <option value="">Select a timeline…</option>
                    <option>Within 2 weeks</option>
                    <option>Within a month</option>
                    <option>Next quarter</option>
                    <option>Next school year</option>
                    <option>Just exploring for now</option>
                  </select>
                </Field>

                {/* Community Schools: extra fields */}
                {form.assessmentType === 'community-schools' && (
                  <>
                    <Field label="What is your primary goal for this pilot?">
                      <select value={form.primaryGoal} onChange={e => set('primaryGoal', e.target.value)} className={SELECT_CLS}>
                        <option value="">Select one…</option>
                        <option>LCAP / strategic planning data</option>
                        <option>Family engagement and outreach</option>
                        <option>School climate and belonging</option>
                        <option>Program evaluation</option>
                        <option>Staff professional learning</option>
                        <option>Other</option>
                      </select>
                    </Field>
                    <Field label="Are you part of a Community Schools initiative?">
                      <select value={form.communityModel} onChange={e => set('communityModel', e.target.value)} className={SELECT_CLS}>
                        <option value="">Select one…</option>
                        <option>Yes — state-funded Community Schools</option>
                        <option>Yes — district-led model</option>
                        <option>No — but interested in the approach</option>
                        <option>Not sure</option>
                      </select>
                    </Field>
                  </>
                )}

                {/* Learner Portrait: extra fields */}
                {form.assessmentType === 'learner-portrait' && (
                  <Field label="Which competency areas are most relevant?">
                    <select value={form.competencyFocus} onChange={e => set('competencyFocus', e.target.value)} className={SELECT_CLS}>
                      <option value="">Select one…</option>
                      <option>SEL — social-emotional skills</option>
                      <option>Academic identity and purpose</option>
                      <option>Career and college readiness</option>
                      <option>Community and civic engagement</option>
                      <option>All of the above</option>
                    </select>
                  </Field>
                )}

                {/* Behavioral Health: extra fields */}
                {form.assessmentType === 'behavioral-health' && (
                  <Field label="Is this universal screening or targeted outreach?">
                    <select value={form.screeningScope} onChange={e => set('screeningScope', e.target.value)} className={SELECT_CLS}>
                      <option value="">Select one…</option>
                      <option>Universal — screening full grade or school</option>
                      <option>Targeted — specific student population</option>
                      <option>Not sure yet</option>
                    </select>
                  </Field>
                )}

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <button
                    disabled={!canAdvanceStep3}
                    onClick={() => setStep(4)}
                    className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Contact details ────────────────────────── */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Your contact details</h3>
                  <p className="text-sm text-gray-500 mb-5">We will follow up within 1–2 business days to get things set up.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name" required>
                    <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Alex Rivera" className={INPUT_CLS} />
                  </Field>
                  <Field label="Email" required>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="alex@district.edu" className={INPUT_CLS} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Role / Title">
                    <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Director of Student Support" className={INPUT_CLS} />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" className={INPUT_CLS} />
                  </Field>
                </div>

                <Field label="School or District" required>
                  <input value={form.organization} onChange={e => set('organization', e.target.value)} placeholder="Lincoln Unified School District" className={INPUT_CLS} />
                </Field>

                <Field label="Anything else you want us to know?">
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Specific questions, constraints, or goals…"
                    rows={3}
                    className={INPUT_CLS + ' resize-none'}
                  />
                </Field>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <button
                    disabled={!canAdvanceStep4 || submitting}
                    onClick={submit}
                    className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 5: Confirmation ───────────────────────────── */}
            {step === 5 && (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">You are all set, {form.name.split(' ')[0]}.</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                  We received your request and will be in touch at <strong>{form.email}</strong> within 1–2 business days to talk through next steps.
                </p>
                <p className="text-xs text-gray-400 mt-6">
                  Questions in the meantime? Reply to the confirmation email or reach us at{' '}
                  <span className="text-indigo-500">hello@impacterpathway.com</span>.
                </p>
              </div>
            )}
          </div>
          </div>{/* end scrollable body */}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Impacter Pathway · Student Voice, Powered by AI</p>
      </footer>
    </div>
  );
}
