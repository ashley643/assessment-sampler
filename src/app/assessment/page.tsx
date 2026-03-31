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
        className="hidden md:flex md:w-[55%] relative flex-col justify-center p-14 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1a2744 0%, #2d4a7a 45%, #c75a3a 100%)',
        }}
      >
        {/* Wheel — large background watermark, not in flow */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none animate-spin-slow"
          style={{ opacity: 0.18 }}
        >
          <Image
            src="/Anchor Words Wheel Solo.png"
            alt=""
            width={520}
            height={520}
            className="object-contain"
            priority
          />
        </div>

        {/* Foreground content — left-aligned */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="mb-10">
            <Image
              src="/Logo Transparent Background.png"
              alt="Impacter Pathway"
              width={190}
              height={57}
              className="object-contain"
              priority
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            Student Voice.<br />
            Powered by{' '}
            <span style={{ color: '#e8735a' }}>AI.</span>
          </h1>
          <p className="text-white/70 text-lg max-w-sm leading-relaxed mb-10">
            Real-time insights from student assessments — helping districts
            listen deeper and act faster.
          </p>

          {/* Stat badges */}
          <div className="flex gap-3">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex flex-col px-5 py-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.12)',
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
      </div>

      {/* ── Right form panel ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8 overflow-y-auto">
        <div className="w-full max-w-md animate-slide-up py-6">

          {/* Brand mark */}
          <div className="mb-8 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden"
              style={{ background: '#1a2744' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Logo Transparent Background.png"
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'left center',
                }}
              />
            </div>
            <div className="leading-tight">
              <div
                className="text-sm font-bold tracking-wide"
                style={{ color: '#1a2744' }}
              >
                Impacter
              </div>
              <div className="text-xs font-medium tracking-wide text-gray-400">
                Pathway®
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Try Our Assessments
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
                placeholder="e.g. SAMPLE2026"
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
