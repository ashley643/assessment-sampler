'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import codesData from '@/data/codes.json';

function validateCode(input: string): { valid: boolean; expired: boolean } {
  const normalized = input.trim().toUpperCase();
  const entry = codesData.codes.find((c) => c.code === normalized);
  if (!entry) return { valid: false, expired: false };
  const expired = new Date() > new Date(entry.expires);
  return { valid: true, expired };
}

const STATS = [
  { value: '5',    label: 'SEL Competencies' },
  { value: '100%', label: 'AI-Scored' },
  { value: '50+',  label: 'Languages' },
];

export default function AssessmentEntryPage() {
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 700);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateCode(code);

    if (!result.valid) {
      setError('Invalid access code. Please check and try again.');
      triggerShake();
      return;
    }
    if (result.expired) {
      setError('This access code has expired. Contact your representative for a new one.');
      triggerShake();
      return;
    }

    setLoading(true);
    router.push(`/assessment/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* ── Left hero panel ────────────────────────────────── */}
      <div
        className="hidden md:flex md:w-[55%] relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{
          background:
            'linear-gradient(160deg, #1a2744 0%, #2d4a7a 45%, #c75a3a 100%)',
        }}
      >
        {/* Logo */}
        <div className="mb-6 z-10">
          <Image
            src="/Logo_Transparent_Background.png"
            alt="Impacter Pathway"
            width={210}
            height={63}
            className="object-contain"
            priority
          />
        </div>

        {/* Spinning wheel */}
        <div
          className="animate-spin-slow mb-8 z-10"
          style={{ width: 340, height: 340 }}
        >
          <Image
            src="/Anchor_Words_Wheel_Solo.png"
            alt="Impacter Pathway Anchor Attributes Wheel"
            width={340}
            height={340}
            className="w-full h-full object-contain"
            priority
          />
        </div>

        {/* Headline */}
        <div className="text-center mb-8 z-10">
          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            Student Voice.<br />
            Powered by{' '}
            <span style={{ color: '#e8735a' }}>AI.</span>
          </h1>
          <p className="text-white/70 text-lg max-w-md leading-relaxed">
            Real-time insights from student assessments — helping districts
            listen deeper and act faster.
          </p>
        </div>

        {/* Stat badges */}
        <div className="flex gap-4 z-10">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center px-5 py-3 rounded-xl text-center"
              style={{
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-white font-bold text-xl">{s.value}</span>
              <span className="text-white/80 text-sm whitespace-nowrap">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md animate-slide-up">
          {/* Brand mark */}
          <div className="mb-8 flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#1a2744' }}
            >
              <Image
                src="/Logo_Transparent_Background.png"
                alt=""
                width={22}
                height={22}
                className="object-contain"
              />
            </div>
            <div className="leading-none">
              <div
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: '#1a2744' }}
              >
                Impacter
              </div>
              <div className="text-xs font-medium tracking-wider uppercase text-gray-400">
                Pathway®
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Access Your Sample Dashboard
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Enter the access code provided by your Impacter Pathway representative.
          </p>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit} noValidate>
              <label
                htmlFor="access-code"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Access Code
              </label>
              <input
                id="access-code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="e.g. SMFCSD2026"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={[
                  'w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent',
                  'transition-all text-base',
                  error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
                  shaking ? 'animate-shake' : '',
                ].join(' ')}
              />
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full mt-5 py-3 rounded-xl text-white font-semibold text-sm tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
                style={{ background: '#6b7fa8' }}
              >
                {loading ? 'Loading…' : 'View Samples'}
              </button>
            </form>
          </div>

          <p className="text-center text-gray-400 text-sm mt-6">
            Need help?{' '}
            <a
              href="mailto:support@impacterpathway.com"
              className="hover:underline"
              style={{ color: '#4a6fa5' }}
            >
              support@impacterpathway.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
