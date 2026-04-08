'use client';

import { useState } from 'react';

// ── Deterministic hash: same sampleId → same avatar every time ──────────────
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function isDirectAudio(url: string) {
  return /\.(mp3|ogg|m4a|wav|aac)(\?|$)/i.test(url);
}

// ── Three variants per demographic type: different skin + hair ───────────────
const SKIN_TONES = ['#FDDBB4', '#F5C18A', '#D4956A'] as const;
const F_HAIR     = ['#8B4513', '#4A2C0A', '#1A0A00'] as const;
const M_HAIR     = ['#2D1B0E', '#5C3D2E', '#1A0A00'] as const;

function avatarCfg(gender: string | null, grade: string | null, variant: number) {
  const g  = (gender ?? '').toLowerCase();
  const gn = (() => { const n = parseInt(grade ?? '', 10); return isNaN(n) ? null : n; })();
  const isFemale = g.includes('female') || g === 'f' || g === 'girl' || g === 'woman';
  const isMale   = !isFemale && (g.includes('male') || g === 'm' || g === 'boy' || g === 'man');
  const isKid    = gn !== null && gn <= 5;
  const isTween  = gn !== null && gn >= 6 && gn <= 8;
  const isTeen   = gn !== null && gn >= 9;
  const isAdult  = !isKid && !isTween && !isTeen;
  const v     = variant % 3;
  const skin  = SKIN_TONES[v];
  const hair  = isFemale ? F_HAIR[v] : M_HAIR[v];
  const bg    = isFemale
    ? (isKid ? '#FFD6E7' : isTween ? '#DDD6FF' : isTeen ? '#FFD0EC' : '#FFBDD0')
    : isMale
    ? (isKid ? '#B8DAFF' : isTween ? '#C3F5D6' : isTeen ? '#B3F0FF' : '#FFD6B3')
    : '#E5E5E5';
  const shirt = isFemale
    ? (isKid ? '#FF69B4' : isTween ? '#9B59B6' : isTeen ? '#E91E8C' : '#C0392B')
    : isMale
    ? (isKid ? '#3498DB' : isTween ? '#27AE60' : isTeen ? '#2980B9' : '#E67E22')
    : '#888888';
  const blush = (isKid || (isFemale && isTween)) && v < 2;
  const label = gn !== null
    ? (isKid ? 'Elementary' : isTween ? 'Middle School' : 'High School')
    : 'Parent / Adult';
  return { isFemale, isMale, isKid, isTween, isTeen, isAdult, skin, hair, bg, shirt, blush, label };
}

// ── SVG avatar ───────────────────────────────────────────────────────────────
function DemoAvatar({ gender, grade, sampleId, size = 96 }: {
  gender: string | null;
  grade: string | null;
  sampleId: string;
  size?: number;
}) {
  const variant = hashStr(sampleId) % 3;
  const { isFemale, isMale, isKid, isTween, isTeen, isAdult, skin, hair, shirt, blush } = avatarCfg(gender, grade, variant);

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Shirt / body */}
      <ellipse cx="40" cy="76" rx="24" ry="16" fill={shirt} />
      <rect x="28" y="60" width="24" height="20" rx="3" fill={shirt} />
      {/* Long hair behind head */}
      {isFemale && isTeen && (
        <>
          <path d="M27 29 C19 39 17 54 22 66" stroke={hair} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d="M53 29 C61 39 63 54 58 66" stroke={hair} strokeWidth="11" strokeLinecap="round" fill="none" />
        </>
      )}
      {isFemale && isTween && (
        <path d="M53 28 C65 33 69 45 64 56 C62 61 59 62 57 59" stroke={hair} strokeWidth="11" strokeLinecap="round" fill="none" />
      )}
      {/* Neck */}
      <rect x="36" y="52" width="8" height="10" rx="2" fill={skin} />
      {/* Ears */}
      <ellipse cx="26" cy="38" rx="3" ry="4" fill={skin} />
      <ellipse cx="54" cy="38" rx="3" ry="4" fill={skin} />
      {/* Head */}
      <ellipse cx="40" cy="36" rx="14" ry="17" fill={skin} />
      {/* Hair */}
      {isFemale && isKid && (
        <>
          <ellipse cx="40" cy="22" rx="14" ry="9" fill={hair} />
          <circle cx="22" cy="32" r="7" fill={hair} />
          <circle cx="58" cy="32" r="7" fill={hair} />
          <path d="M15 25 Q22 20 21 28 Q22 36 15 31 Q18 28 15 25" fill="#FF1493" />
          <path d="M29 25 Q22 20 23 28 Q22 36 29 31 Q26 28 29 25" fill="#FF1493" />
          <circle cx="22" cy="28" r="2.5" fill="#FF1493" />
          <path d="M51 25 Q58 20 57 28 Q58 36 51 31 Q54 28 51 25" fill="#FF1493" />
          <path d="M65 25 Q58 20 59 28 Q58 36 65 31 Q62 28 65 25" fill="#FF1493" />
          <circle cx="58" cy="28" r="2.5" fill="#FF1493" />
        </>
      )}
      {isFemale && isTween && (
        <>
          <ellipse cx="40" cy="22" rx="14" ry="9" fill={hair} />
          <circle cx="56" cy="28" r="3.5" fill="#CC66FF" />
        </>
      )}
      {isFemale && isTeen  && <ellipse cx="40" cy="22" rx="14" ry="9" fill={hair} />}
      {isFemale && isAdult && (
        <>
          <ellipse cx="40" cy="23" rx="13" ry="8" fill={hair} />
          <circle cx="40" cy="14" r="8" fill={hair} />
          <path d="M34 12 Q40 9 46 12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
        </>
      )}
      {isMale && isKid && (
        <>
          <ellipse cx="40" cy="22" rx="13" ry="9" fill={hair} />
          <polygon points="28,22 30,11 33,22" fill={hair} />
          <polygon points="36,21 39,9 42,21" fill={hair} />
          <polygon points="47,22 50,11 52,22" fill={hair} />
        </>
      )}
      {isMale && isTween  && <ellipse cx="40" cy="22" rx="13" ry="8" fill={hair} />}
      {isMale && isTeen   && (
        <>
          <ellipse cx="40" cy="21" rx="13" ry="9" fill={hair} />
          <path d="M30 22 Q42 15 52 22" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
        </>
      )}
      {isMale && isAdult  && <ellipse cx="40" cy="23" rx="12" ry="7" fill={hair} />}
      {!isFemale && !isMale && <ellipse cx="40" cy="22" rx="13" ry="8" fill={hair} />}
      {/* Eyebrows */}
      <path d="M30 30 Q33.5 28 37 30" stroke={hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M43 30 Q46.5 28 50 30" stroke={hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Eyes */}
      <ellipse cx="33.5" cy="36" rx="3.2" ry="3.5" fill="white" />
      <ellipse cx="46.5" cy="36" rx="3.2" ry="3.5" fill="white" />
      <circle cx="33.5" cy="36.5" r="2.3" fill="#2D1B0E" />
      <circle cx="46.5" cy="36.5" r="2.3" fill="#2D1B0E" />
      <circle cx="34.5" cy="35.2" r="0.9" fill="white" />
      <circle cx="47.5" cy="35.2" r="0.9" fill="white" />
      {/* Nose */}
      <path d="M38.5 42 Q37 44 38.5 45 Q40 44 41.5 45 Q43 44 41.5 42" stroke="#C87040" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Smile */}
      <path d="M35 49.5 Q40 54 45 49.5" stroke="#B05828" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Blush */}
      {blush && (
        <>
          <ellipse cx="27.5" cy="42" rx="4" ry="2.5" fill="#FFB3C6" opacity="0.5" />
          <ellipse cx="52.5" cy="42" rx="4" ry="2.5" fill="#FFB3C6" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
/**
 * Renders audio sample responses as a demographic avatar card.
 *
 * Two modes:
 * - Direct audio URL (mp3/m4a/etc): persistent card — avatar stays visible
 *   while the <audio> element plays. No VideoAsk interface shown at all.
 * - VideoAsk share URL: poster with play button; clicking swaps in the iframe.
 *   (Legacy path for already-assigned samples that have VideoAsk URLs stored.)
 */
export function AudioAvatarPlayer({
  embedUrl,
  gender,
  grade,
  sampleId,
  iframeClassName = 'w-full aspect-video',
  iframeStyle,
}: {
  embedUrl: string;
  gender?: string | null;
  grade?: string | null;
  sampleId: string;
  /** Classes for the iframe rendered in the VideoAsk fallback path. */
  iframeClassName?: string;
  iframeStyle?: React.CSSProperties;
}) {
  const [playing, setPlaying] = useState(false);
  const variant  = hashStr(sampleId) % 3;
  const { bg, label } = avatarCfg(gender ?? null, grade ?? null, variant);

  // ── Mode 1: direct audio file → persistent avatar + <audio> ─────────────
  if (isDirectAudio(embedUrl)) {
    return (
      <div className="w-full flex items-center gap-5 px-6 py-5" style={{ background: bg }}>
        <div className="flex-shrink-0">
          <DemoAvatar gender={gender ?? null} grade={grade ?? null} sampleId={sampleId} size={88} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label}</p>
          <audio
            controls
            preload="metadata"
            src={embedUrl}
            className="w-full"
            style={{ height: '36px' }}
          />
        </div>
      </div>
    );
  }

  // ── Mode 2: VideoAsk URL → poster, then iframe on click ─────────────────
  if (playing) {
    return (
      <iframe
        src={embedUrl}
        allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *; display-capture *;"
        className={iframeClassName}
        style={iframeStyle}
        title="Sample audio response"
      />
    );
  }

  return (
    <div
      className="w-full flex items-center gap-5 px-6 py-5 cursor-pointer group select-none"
      style={{ background: bg }}
      onClick={() => setPlaying(true)}
      role="button"
      aria-label="Play sample audio response"
    >
      <div className="flex-shrink-0">
        <DemoAvatar gender={gender ?? null} grade={grade ?? null} sampleId={sampleId} size={88} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label}</p>
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-full px-4 py-2.5 shadow-sm group-hover:bg-white transition-colors w-fit">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="9" fill="#1a2744" />
            <polygon points="7.5,6 13.5,9 7.5,12" fill="white" />
          </svg>
          <span className="text-sm font-semibold text-[#1a2744]">Play response</span>
        </div>
      </div>
    </div>
  );
}
