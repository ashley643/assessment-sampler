'use client';

import { useState, useRef, useEffect } from 'react';

// ── Sample CSV data ──────────────────────────────────────────────────────────
const CSV_COLS = [
  'Timestamp', 'School', 'Grade', 'Gender',
  'Q1 Response', 'Q1 Time',
  'Q2 Response', 'Q2 Time',
  'Q3 Response', 'Q3 Time',
  'Score (200–800)', 'Language Style', 'Community Signal', 'Unmet Need', 'Next Step',
];

const CSV_ROWS = [
  ['10/3/2024 9:14', 'Riverside Elem.', '5th', 'Female',
    'I care most about my family. My mom works two jobs and I want to make her proud one day…', '1m 42s',
    'It was hard when I switched schools. I cried a lot but I kept going even when I wanted to quit…', '2m 05s',
    'I need more time to ask questions. I always feel like I\'m behind and rushing to keep up.', '1m 18s',
    '512', 'Reflective, future-oriented', 'Strong family connection; high belonging', 'Academic pacing support', 'Teacher check-in'],
  ['10/3/2024 9:22', 'Riverside Elem.', '5th', 'Male',
    'I care about being a good friend. I want people to know they can count on me when things get hard…', '1m 29s',
    'My grandpa passed away. I was really sad but I started talking to my teacher and that helped a lot…', '1m 55s',
    'I need more time to just breathe. I feel stressed about tests a lot of the time.', '0m 58s',
    '478', 'Grounded, interpersonal', 'Peer support-seeking; relational awareness', 'Emotional regulation support', 'Counselor check-in'],
  ['10/3/2024 10:01', 'Washington Middle', '7th', 'Female',
    'I care about the environment. I\'ve been learning about climate change and it worries me…', '2m 11s',
    'Math was really hard for me. I got tutoring and worked at it, and now I actually enjoy it.', '1m 47s',
    'I\'d love more hands-on projects. I learn so much better when I\'m doing something, not just reading.', '1m 32s',
    '634', 'Analytical, solution-focused', 'High academic confidence; growth mindset', 'Enrichment opportunity', 'Leadership program referral'],
  ['10/3/2024 10:08', 'Washington Middle', '8th', 'Non-binary',
    'I care about art. I paint and draw. It\'s the only place where I feel like I can say anything.', '2m 33s',
    'People have made fun of the way I look. I still show up every day. I try not to let it stop me.', '1m 59s',
    'I need people to just not judge me. I want to feel safe being myself at school.', '1m 44s',
    '389', 'Expressive, vulnerable', 'Low sense of safety; identity stress', 'Belonging and safety support', 'Immediate counselor outreach'],
  ['10/3/2024 11:15', 'Lincoln High', '10th', 'Male',
    'I care about my future and making my parents proud. There is a lot of pressure but also a lot of love…', '1m 38s',
    'Balancing school, sports, and expectations has been really hard. I had to learn to say no sometimes.', '2m 20s',
    'More mental health resources at school would help. Sometimes it\'s hard to find someone to talk to.', '1m 51s',
    '558', 'Accomplished, pressured', 'High drive; potential burnout risk', 'Wellbeing check-in', 'Peer mentorship pairing'],
  ['10/3/2024 11:29', 'Lincoln High', '11th', 'Female',
    'I care about justice. I\'ve seen unfair things in my community and I want to be someone who changes it.', '2m 44s',
    'I didn\'t think I was smart enough for AP classes. My counselor pushed me. I\'m doing it now.', '2m 18s',
    'More counselors. There is only one for the whole grade and it\'s not enough.', '1m 22s',
    '601', 'Advocacy-oriented, resilient', 'High civic engagement; strong self-efficacy', 'System-level voice opportunity', 'Student voice program flag'],
];

// ── Score heatmap helper ─────────────────────────────────────────────────────
function scoreColor(score: number): { bg: string; text: string } {
  if (score >= 600) return { bg: '#d1fae5', text: '#065f46' };
  if (score >= 500) return { bg: '#fef9c3', text: '#854d0e' };
  if (score >= 400) return { bg: '#fed7aa', text: '#9a3412' };
  return { bg: '#fee2e2', text: '#991b1b' };
}

// ── Report insight chart data ────────────────────────────────────────────────
const BH_DOMAIN_DATA = [
  { domain: 'Reflective Growth',    female: 624, male: 548, ling: { marker: '"used to / now" contrast',   fPct: '12%', mPct: '5%'  } },
  { domain: 'Relational Awareness', female: 591, male: 469, ling: { marker: '"we / together / each other"', fPct: '18%', mPct: '6%'  } },
  { domain: 'Emotional Resilience', female: 558, male: 501, ling: { marker: '"still / kept going" markers',  fPct: '9%',  mPct: '5%'  } },
  { domain: 'Self-Insight',         female: 607, male: 542, ling: { marker: '"I realized / I noticed"',      fPct: '14%', mPct: '6%'  } },
  { domain: 'Conflict Resolution',  female: 572, male: 473, ling: { marker: '"instead / different way"',     fPct: '11%', mPct: '3%'  } },
];

// 42 dots — smaller radius, heavy concentration in the high-high (Purpose/Self-Control) zone
const WELLNESS_DOTS = [
  // High-high cluster (x 88–99, y 88–99) — 22 dots
  { x: 91, y: 93 }, { x: 94, y: 96 }, { x: 89, y: 91 }, { x: 96, y: 94 },
  { x: 92, y: 97 }, { x: 88, y: 95 }, { x: 95, y: 91 }, { x: 90, y: 98 },
  { x: 97, y: 95 }, { x: 93, y: 92 }, { x: 99, y: 97 }, { x: 91, y: 90 },
  { x: 96, y: 99 }, { x: 88, y: 92 }, { x: 94, y: 90 }, { x: 98, y: 93 },
  { x: 92, y: 95 }, { x: 90, y: 94 }, { x: 95, y: 98 }, { x: 89, y: 96 },
  { x: 93, y: 99 }, { x: 97, y: 91 },
  // Mid zone (x 80–87, y 80–87) — 10 dots
  { x: 83, y: 86 }, { x: 86, y: 83 }, { x: 81, y: 85 }, { x: 85, y: 82 },
  { x: 84, y: 87 }, { x: 82, y: 84 }, { x: 87, y: 86 }, { x: 80, y: 83 },
  { x: 86, y: 85 }, { x: 83, y: 81 },
  // Lower-mid scatter — 10 dots
  { x: 76, y: 82 }, { x: 80, y: 78 }, { x: 74, y: 79 }, { x: 78, y: 85 },
  { x: 82, y: 75 }, { x: 71, y: 77 }, { x: 79, y: 80 }, { x: 85, y: 76 },
  { x: 73, y: 83 }, { x: 77, y: 76 },
];

// Risk heatmap: rows × grade columns (6th, 7th, 8th) — % frequency 0.00–7.25
const RISK_ROWS = [
  { pattern: 'Hopelessness',         g6: 6.43, g7: 4.21, g8: 5.87, ling: '"nothing ever changes / always like this"',  gradeRank: '6th > 8th > 7th' },
  { pattern: 'Withdrawal cues',      g6: 3.18, g7: 5.62, g8: 4.09, ling: '"stopped / don\'t bother / gave up"',         gradeRank: '7th > 8th > 6th' },
  { pattern: 'Avoidance signals',    g6: 2.74, g7: 3.91, g8: 5.33, ling: '"don\'t want to / just skip it"',             gradeRank: '8th > 7th > 6th' },
  { pattern: 'Self-doubt language',  g6: 4.56, g7: 6.88, g8: 7.12, ling: '"probably wrong / not smart enough"',         gradeRank: '8th > 7th > 6th' },
  { pattern: 'Help-seeking absence', g6: 1.93, g7: 2.47, g8: 3.85, ling: '"figured it out alone / didn\'t ask"',        gradeRank: '8th > 7th > 6th' },
];

const PROTECTIVE_DATA = [
  { factor: 'Family connection',       val: 74, type: 'relational' },
  { factor: 'Trusted adult at school', val: 68, type: 'relational' },
  { factor: 'Peer support',            val: 62, type: 'relational' },
  { factor: 'Growth mindset',          val: 71, type: 'internal' },
  { factor: 'Emotional regulation',    val: 65, type: 'internal' },
  { factor: 'Help-seeking readiness',  val: 58, type: 'internal' },
];

const PARTHENON_PILLARS = [
  {
    label: 'Integrated Student Supports', height: 92, color: '#4a6fa5', score: '0.97',
    schools: [
      { name: 'Riverview K-8',      score: 1.04, leads: true  },
      { name: 'Mesa Vista Elem',    score: 0.94, leads: false },
      { name: 'Northgate Academy',  score: 0.93, leads: false },
    ],
    insight: 'Riverview K-8 leads — counselor-to-student ratio 2× district avg',
  },
  {
    label: 'Family & Community Engagement', height: 76, color: '#2d7a5f', score: '0.88',
    schools: [
      { name: 'Riverview K-8',      score: 0.83, leads: false },
      { name: 'Mesa Vista Elem',    score: 1.02, leads: true  },
      { name: 'Northgate Academy',  score: 0.79, leads: false },
    ],
    insight: 'Mesa Vista Elem leads — bilingual family nights drive engagement',
  },
  {
    label: 'Collaborative Leadership', height: 68, color: '#7c5cbf', score: '0.82',
    schools: [
      { name: 'Riverview K-8',      score: 0.78, leads: false },
      { name: 'Mesa Vista Elem',    score: 0.80, leads: false },
      { name: 'Northgate Academy',  score: 0.88, leads: true  },
    ],
    insight: 'Northgate Academy leads — shared decision-making model adopted in 2023',
  },
  {
    label: 'Expanded Learning Time', height: 83, color: '#e07b54', score: '0.93',
    schools: [
      { name: 'Riverview K-8',      score: 0.98, leads: true  },
      { name: 'Mesa Vista Elem',    score: 0.93, leads: false },
      { name: 'Northgate Academy',  score: 0.88, leads: false },
    ],
    insight: 'Riverview K-8 leads — after-school partnerships add 6 hrs/week',
  },
];

// Linguistic tone divergence by stakeholder
const VOICE_TONE = [
  { group: 'Families',  affirming: 68, concern: 22, neutral: 10, constructiveSignal: 'more communication', affirmingSignal: 'belonging & partnership' },
  { group: 'Students',  affirming: 54, concern: 31, neutral: 15, constructiveSignal: 'fairness & being heard', affirmingSignal: 'safety & connection' },
  { group: 'Staff',     affirming: 53, concern: 44, neutral: 11, constructiveSignal: 'workload concerns', affirmingSignal: 'student growth/pride' },
];

// ── VideoAsk previews ────────────────────────────────────────────────────────
const PREVIEWS = [
  {
    label: 'Empathy Interview',
    org: 'Vista High School',
    url: 'https://vistahs.impacterpathway.com/fzbfs0rrd?preview',
  },
  {
    label: 'Community Schools Parent Survey',
    org: 'San Mateo-Foster City USD',
    url: 'https://smfcsd.impacterpathway.com/f5wvxewbq?preview',
  },
  {
    label: 'Graduate Portrait Survey',
    org: 'Western Placer USD',
    url: 'https://wpusd.impacterpathway.com/f78d5omaf?preview',
  },
];

// ── Demo player panels ───────────────────────────────────────────────────────
interface DemoCaption { t: number; text: string; accent?: true }
interface DemoChip { t: number; text: string; color: string }
interface DemoWord { t: number; word: string }
interface DemoPanel {
  assessmentName: string;
  school: string;
  promptLabel: string;
  promptText: string;
  questionUrl: string;
  responseUrl: string;
  respondentLabel: string;
  captions: DemoCaption[];
  chips: DemoChip[];
  words: DemoWord[];
  scoreTimeline: { t: number; score: number }[];
}

function interpolateScore(tl: { t: number; score: number }[], time: number): number {
  if (!tl.length) return 400;
  if (time <= tl[0].t) return tl[0].score;
  const last = tl[tl.length - 1];
  if (time >= last.t) return last.score;
  const i = tl.findIndex(k => k.t > time);
  const a = tl[i - 1], b = tl[i];
  return a.score + (b.score - a.score) * (time - a.t) / (b.t - a.t);
}

function ScoreDial({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const w = size === 'lg' ? 180 : 108;
  const h = size === 'lg' ? 138 : 83;
  const cx = w / 2, cy = h * 0.74;
  const r  = size === 'lg' ? 64 : 38;
  const sw = size === 'lg' ? 8 : 5;
  const fs = size === 'lg' ? 26 : 15;

  // Arc: 120° → 420° clockwise (300° sweep, 7 o'clock → 5 o'clock)
  const toXY = (deg: number) => ({
    x: cx + r * Math.cos(deg * Math.PI / 180),
    y: cy + r * Math.sin(deg * Math.PI / 180),
  });
  const s0 = toXY(120), sEnd = toXY(420);
  const clamped = Math.max(200, Math.min(800, score));
  const arcDeg = (clamped - 200) / 600 * 300;
  const sPt = toXY(120 + arcDeg);
  const nRad = (120 + arcDeg) * Math.PI / 180;
  const nx = cx + r * 0.82 * Math.cos(nRad);
  const ny = cy + r * 0.82 * Math.sin(nRad);
  const color = clamped >= 680 ? '#34d399' : clamped >= 520 ? '#fbbf24' : '#fb7185';
  const ease = 'transition:all 0.55s cubic-bezier(0.25,0.1,0.25,1)';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      <path d={`M${s0.x} ${s0.y} A${r} ${r} 0 1 1 ${sEnd.x} ${sEnd.y}`}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={sw} strokeLinecap="round" />
      {arcDeg > 1 && (
        <path d={`M${s0.x} ${s0.y} A${r} ${r} 0 ${arcDeg > 180 ? 1 : 0} 1 ${sPt.x} ${sPt.y}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          style={{ transition: 'all 0.55s cubic-bezier(0.25,0.1,0.25,1)' }} />
      )}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color}
        strokeWidth={size === 'lg' ? 2.5 : 1.8} strokeLinecap="round"
        style={{ transition: 'all 0.55s cubic-bezier(0.25,0.1,0.25,1)' }} />
      <circle cx={cx} cy={cy} r={size === 'lg' ? 5 : 3.5} fill={color}
        style={{ transition: 'fill 0.55s' }} />
      <text x={cx} y={cy - r * 0.28} textAnchor="middle" fill="white"
        fontSize={fs} fontWeight="800" fontFamily="-apple-system,system-ui,sans-serif"
        style={{ transition: 'all 0.3s' }}>{Math.round(clamped)}</text>
      <text x={s0.x - 2} y={s0.y + (size === 'lg' ? 13 : 9)} textAnchor="middle"
        fill="rgba(255,255,255,0.28)" fontSize={size === 'lg' ? 9 : 6}
        fontFamily="-apple-system,system-ui,sans-serif">200</text>
      <text x={sEnd.x + 2} y={sEnd.y + (size === 'lg' ? 13 : 9)} textAnchor="middle"
        fill="rgba(255,255,255,0.28)" fontSize={size === 'lg' ? 9 : 6}
        fontFamily="-apple-system,system-ui,sans-serif">800</text>
    </svg>
  );
}

const DEMO_PANELS: DemoPanel[] = [
  {
    assessmentName: 'Behavioral Health Screener',
    school: 'San Diego Unified School District',
    promptLabel: 'Assessment Prompt · Reflective Growth',
    promptText: "What\u2019s something you\u2019re better at now than you used to be? And what do you think helped you get there?",
    questionUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Elem_Middle_1_Reflective_Growth_BHS_V3.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvRWxlbV9NaWRkbGVfMV9SZWZsZWN0aXZlX0dyb3d0aF9CSFNfVjMubXA0IiwiaWF0IjoxNzc2MTQzMTE1LCJleHAiOjIwOTE1MDMxMTV9.cM1GzrU1TGx_-P0XX-IQYEPzVDI2v-9I7wR3W5IyJd0',
    responseUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/ninja.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvbmluamEubXA0IiwiaWF0IjoxNzc2MTQzMTU4LCJleHAiOjIwOTE1MDMxNTh9.5wghUx912E7YtyaBGOX9wxnpUhjK3E8BHyCPG9py6IM',
    respondentLabel: 'Student',
    captions: [
      { t: 0,    text: 'In first grade, I was very energetic,', accent: true },
      { t: 6.0,  text: 'bouncing off the walls energetic.' },
      { t: 10.7, text: 'Like Super Ninja Turtles running around.' },
      { t: 13.5, text: 'everyone in the classroom.' },
      { t: 15,   text: "But now I\u2019ve gradually gotten better" },
      { t: 19.7, text: 'and better by time.' },
      { t: 23,   text: 'Because in second grade, I learned that \u2014', accent: true },
      { t: 27.7, text: 'just take a break, take a break.' },
      { t: 31,   text: "It\u2019s not that hard, just take a break." },
      { t: 33,   text: 'And ask the teacher if you could have' },
      { t: 35.2, text: 'a break or like ask for help.' },
      { t: 39,   text: 'So, yeah, I started acting a little better.' },
      { t: 44,   text: "I\u2019m not saying that I\u2019m like" },
      { t: 45.3, text: 'the best of the best.' },
      { t: 46,   text: "I\u2019m like better than I", accent: true },
      { t: 50.8, text: 'used to be.' },
      { t: 52,   text: "But, yeah, been doing good." },
    ],
    chips: [
      { t: 1,  text: 'Adversity-Persistence',  color: '#60a5fa' },
      { t: 8,  text: 'Emotional Awareness',    color: '#38bdf8' },
      { t: 15, text: 'Contrastive Structure',  color: '#a78bfa' },
      { t: 19, text: 'Resilience',             color: '#4ade80' },
      { t: 23, text: 'Causal Connector',       color: '#34d399' },
      { t: 33, text: 'Help-Seeking',           color: '#fbbf24' },
      { t: 46, text: 'Growth Mindset',         color: '#f472b6' },
      { t: 53, text: 'Self-Awareness',         color: '#fb923c' },
    ],
    words: [
      {t:0.0,word:'In'},{t:1.5,word:'first'},{t:1.9,word:'grade'},{t:3.1,word:'I'},{t:3.1,word:'was'},
      {t:4.8,word:'very'},{t:5.3,word:'energetic'},{t:6.0,word:'extremely'},{t:6.7,word:'energetic'},
      {t:7.5,word:'like'},{t:7.6,word:'bouncing'},{t:7.9,word:'off'},{t:8.4,word:'the'},{t:8.9,word:'walls'},
      {t:8.9,word:'energetic'},{t:10.7,word:'Like'},{t:10.9,word:'Super'},{t:11.6,word:'Ninja'},
      {t:12.2,word:'Turtles'},{t:12.8,word:'running'},{t:13.2,word:'around'},
      {t:13.7,word:'everyone'},{t:14.1,word:'in'},{t:14.7,word:'the'},{t:14.7,word:'classroom'},
      {t:15.0,word:'But'},{t:15.7,word:'now'},{t:16.4,word:"I've"},{t:18.1,word:'gradually'},
      {t:18.1,word:'gotten'},{t:18.9,word:'better'},{t:19.7,word:'and'},{t:20.6,word:'better'},
      {t:21.0,word:'by'},{t:22.6,word:'time'},{t:23.3,word:'Because'},{t:24.2,word:'in'},
      {t:24.5,word:'second'},{t:24.7,word:'grade'},{t:25.1,word:'I'},{t:25.3,word:'learned'},
      {t:25.6,word:'that'},{t:27.7,word:'um'},{t:28.3,word:'just'},{t:28.7,word:'take'},
      {t:28.9,word:'a'},{t:29.7,word:'break'},{t:29.7,word:'take'},{t:30.2,word:'a'},
      {t:30.6,word:'break'},{t:31.1,word:"It's"},{t:31.6,word:'not'},{t:31.7,word:'that'},
      {t:32.0,word:'hard'},{t:32.2,word:'just'},{t:32.2,word:'take'},{t:32.4,word:'a'},
      {t:32.5,word:'break'},{t:33.4,word:'And'},{t:33.9,word:'ask'},{t:34.2,word:'the'},
      {t:34.5,word:'teacher'},{t:34.6,word:'if'},{t:35.1,word:'you'},{t:35.1,word:'could'},
      {t:35.1,word:'have'},{t:35.2,word:'a'},{t:35.4,word:'break'},{t:35.8,word:'or'},
      {t:36.0,word:'like'},{t:36.3,word:'ask'},{t:36.3,word:'for'},{t:36.8,word:'help'},
      {t:40.4,word:'So'},{t:40.9,word:'yeah'},{t:41.4,word:'I'},{t:41.6,word:'started'},
      {t:41.9,word:'acting'},{t:43.2,word:'a'},{t:43.7,word:'little'},{t:44.0,word:'better'},
      {t:44.3,word:"I'm"},{t:44.4,word:'not'},{t:44.6,word:'saying'},{t:44.8,word:'that'},
      {t:44.9,word:"I'm"},{t:45.0,word:'like'},{t:45.3,word:'the'},{t:45.5,word:'best'},
      {t:45.8,word:'of'},{t:46.0,word:'the'},{t:46.2,word:'best'},{t:46.5,word:"I'm"},
      {t:46.9,word:'like'},{t:47.6,word:'better'},{t:48.3,word:'than'},{t:49.0,word:'I'},
      {t:50.8,word:'used'},{t:51.0,word:'to'},{t:51.3,word:'be'},{t:51.5,word:'better'},
      {t:53.1,word:'But'},{t:53.6,word:'yeah'},{t:55.0,word:'been'},{t:55.6,word:'doing'},
      {t:55.8,word:'good'},{t:58.1,word:'Bye'},
    ],
    scoreTimeline: [
      {t:0,score:200},{t:0.8,score:200},
      {t:2,score:348},   // jump: Adversity-Persistence (t=1)
      {t:7.5,score:348},{t:9,score:438}, // jump: Emotional Self-Report (t=8)
      {t:14.5,score:438},{t:16,score:514}, // jump: Contrastive Structure (t=15)
      {t:18.5,score:514},{t:20,score:558}, // jump: Grit (t=19)
      {t:22.5,score:558},{t:24,score:618}, // jump: Causal Connector (t=23)
      {t:32.5,score:618},{t:34,score:668}, // jump: Help-Seeking (t=33)
      {t:40.5,score:668},{t:42,score:704}, // jump: Cause-Effect (t=41)
      {t:45.5,score:704},{t:47,score:748}, // jump: Growth Mindset (t=46)
      {t:52.5,score:748},{t:54,score:778}, // jump: Self-Awareness (t=53)
      {t:58,score:778},
    ],
  },
  {
    assessmentName: 'Community Schools Assessment',
    school: 'San Mateo-Foster City School District',
    promptLabel: 'Assessment Prompt · Integrated Student Supports',
    promptText: "In your experience, when does your child feel most supported, welcomed, or \u201cseen\u201d at school? What do staff or the school do that helps your child feel safe and connected?",
    questionUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/CSA,_Parent,_Question_1,_Integrated_Student_Supports_(1)_V1%20(1).mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvQ1NBLF9QYXJlbnQsX1F1ZXN0aW9uXzEsX0ludGVncmF0ZWRfU3R1ZGVudF9TdXBwb3J0c18oMSlfVjEgKDEpLm1wNCIsImlhdCI6MTc3NjE0MzgyMiwiZXhwIjoyMDkxNTAzODIyfQ.OeXT8Q1eDFWp-WuFqRgFvvBh5dEo94l7Pmn76PHV3tU',
    responseUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/parent.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvcGFyZW50Lm1wNCIsImlhdCI6MTc3NjE0Mzg1MywiZXhwIjoyMDkxNTAzODUzfQ.oi2qOje4hvioY9GzaQ-dEYvSt1yjyEI_vCVByX8Arko',
    respondentLabel: 'Parent',
    captions: [
      { t: 0,    text: 'I have two kids in Sunnybrae', accent: true },
      { t: 2.9,  text: 'and they feel safe and' },
      { t: 4.0,  text: 'seen in different ways.' },
      { t: 5,    text: 'The older one feels safe and' },
      { t: 6.6,  text: "seen when he\u2019s allowed to" },
      { t: 7.6,  text: 'play soccer, which is his' },
      { t: 8.8,  text: 'favorite activity in the whole world' },
      { t: 10.1, text: 'and he really looks up to the coaches' },
      { t: 12.0, text: "and so they\u2019re a great" },
      { t: 13.9, text: 'role model for him also around that.' },
      { t: 16.9, text: 'The second one feels safe and', accent: true },
      { t: 18.5, text: "seen when he\u2019s given attention and" },
      { t: 22.0, text: 'his emotions are validated,' },
      { t: 24.4, text: 'which happens by his teacher and' },
      { t: 26.1, text: 'all the staff around the school.' },
      { t: 28,   text: 'when he gets hurt at the playground,' },
      { t: 29.8, text: 'he gets to go to' },
      { t: 30.8, text: 'the office and gets a band-aid' },
      { t: 31.9, text: 'and gets taken care of.' },
      { t: 33.4, text: 'He enjoys that and that' },
      { t: 35.0, text: 'makes him feel safe and seen.' },
      { t: 36.5, text: 'So thanks to the school for really', accent: true },
      { t: 39.0, text: 'taking care of both boys' },
      { t: 40.5, text: 'that have different personalities.' },
    ],
    chips: [
      { t: 1,    text: 'Sense of Belonging',    color: '#60a5fa' },
      { t: 7.6,  text: 'Value Statement',       color: '#38bdf8' },
      { t: 13.9, text: 'Trusted Adult',         color: '#34d399' },
      { t: 18.8, text: 'Reciprocity',           color: '#818cf8' },
      { t: 21,   text: 'Emotional Validation',  color: '#a78bfa' },
      { t: 28,   text: 'Integrated Support',    color: '#fbbf24' },
      { t: 33.4, text: 'Compassion',            color: '#4ade80' },
      { t: 36.5, text: 'Family Partnership',    color: '#f472b6' },
    ],
    words: [
      {t:0.0,word:'I'},{t:0.2,word:'have'},{t:1.9,word:'two'},{t:2.1,word:'kids'},
      {t:2.3,word:'in'},{t:2.6,word:'Sunnybrae'},{t:2.9,word:'and'},{t:3.1,word:'they'},
      {t:3.4,word:'feel'},{t:3.6,word:'safe'},{t:3.9,word:'and'},{t:4.1,word:'seen'},
      {t:4.1,word:'in'},{t:4.3,word:'different'},{t:4.6,word:'ways'},{t:5.2,word:'The'},
      {t:5.2,word:'older'},{t:5.4,word:'one'},{t:5.7,word:'feels'},{t:6.0,word:'safe'},
      {t:6.3,word:'and'},{t:6.6,word:'seen'},{t:6.6,word:'when'},{t:6.8,word:"he's"},
      {t:7.0,word:'allowed'},{t:7.2,word:'to'},{t:7.6,word:'play'},{t:7.6,word:'soccer'},
      {t:8.1,word:'which'},{t:8.2,word:'is'},{t:8.3,word:'his'},{t:8.8,word:'favorite'},
      {t:8.8,word:'activity'},{t:9.3,word:'in'},{t:9.5,word:'the'},{t:9.6,word:'whole'},
      {t:9.9,word:'world'},{t:10.1,word:'and'},{t:10.6,word:'he'},{t:10.7,word:'really'},
      {t:11.1,word:'looks'},{t:11.2,word:'up'},{t:11.3,word:'to'},{t:11.4,word:'the'},
      {t:11.8,word:'coaches'},{t:12.0,word:'and'},{t:13.2,word:'so'},{t:13.4,word:"they're"},
      {t:13.5,word:'a'},{t:13.7,word:'great'},{t:13.9,word:'role'},{t:14.4,word:'model'},
      {t:14.5,word:'for'},{t:14.9,word:'him'},{t:15.2,word:'also'},{t:15.6,word:'around'},
      {t:16.1,word:'that'},{t:16.9,word:'The'},{t:17.1,word:'second'},{t:17.4,word:'one'},
      {t:17.8,word:'feels'},{t:18.1,word:'safe'},{t:18.4,word:'and'},{t:18.8,word:'seen'},
      {t:18.8,word:'when'},{t:19.1,word:"he's"},{t:19.3,word:'given'},{t:19.5,word:'attention'},
      {t:20.1,word:'and'},{t:22.0,word:'his'},{t:22.2,word:'emotions'},{t:22.7,word:'are'},
      {t:23.7,word:'validated'},{t:24.4,word:'which'},{t:24.6,word:'happens'},{t:25.0,word:'by'},
      {t:25.3,word:'his'},{t:25.7,word:'teacher'},{t:25.8,word:'and'},{t:26.1,word:'all'},
      {t:26.2,word:'the'},{t:26.4,word:'staff'},{t:26.6,word:'around'},{t:26.8,word:'the'},
      {t:27.4,word:'school'},{t:27.4,word:'Also'},{t:28.3,word:'when'},{t:28.5,word:'he'},
      {t:28.7,word:'gets'},{t:28.9,word:'hurt'},{t:29.1,word:'at'},{t:29.3,word:'the'},
      {t:29.4,word:'playground'},{t:29.8,word:'he'},{t:30.0,word:'gets'},{t:30.0,word:'to'},
      {t:30.1,word:'go'},{t:30.2,word:'to'},{t:30.8,word:'the'},{t:30.8,word:'office'},
      {t:30.8,word:'and'},{t:31.0,word:'gets'},{t:31.3,word:'a'},{t:31.4,word:'band'},
      {t:31.8,word:'aid'},{t:31.9,word:'and'},{t:32.1,word:'gets'},{t:32.3,word:'taken'},
      {t:32.5,word:'care'},{t:32.7,word:'of'},{t:33.4,word:'He'},{t:33.6,word:'enjoys'},
      {t:34.2,word:'that'},{t:34.7,word:'and'},{t:34.9,word:'that'},{t:35.2,word:'makes'},
      {t:35.2,word:'him'},{t:35.4,word:'feel'},{t:35.7,word:'safe'},{t:35.9,word:'and'},
      {t:36.2,word:'seen'},{t:36.6,word:'So'},{t:36.9,word:'thanks'},{t:37.0,word:'to'},
      {t:37.3,word:'the'},{t:37.4,word:'school'},{t:37.6,word:'for'},{t:38.4,word:'really'},
      {t:39.3,word:'taking'},{t:39.5,word:'care'},{t:39.8,word:'of'},{t:39.9,word:'both'},
      {t:40.2,word:'boys'},{t:40.5,word:'that'},{t:40.8,word:'have'},{t:41.0,word:'different'},
      {t:41.3,word:'personalities'},
    ],
    scoreTimeline: [
      {t:0,score:200},{t:0.8,score:200},
      {t:2,score:368},   // jump: Sense of Belonging (t=1)
      {t:7.2,score:368},{t:8.5,score:434}, // jump: Value Statement (t=7.6)
      {t:13.5,score:434},{t:15,score:504}, // jump: Trusted Adult (t=13.9)
      {t:18.4,score:504},{t:19.8,score:558}, // jump: Reciprocity (t=18.8)
      {t:20.6,score:558},{t:22,score:618}, // jump: Emotional Validation (t=21)
      {t:27.5,score:618},{t:29,score:674}, // jump: Integrated Support (t=28)
      {t:33,score:674},{t:34.2,score:714}, // jump: Compassion (t=33.4)
      {t:36,score:714},{t:37.5,score:754}, // jump: Family Partnership (t=36.5)
      {t:41.3,score:756},
    ],
  },
  {
    assessmentName: 'Graduate Portrait',
    school: 'Orange County Office of Education',
    promptLabel: 'Assessment Prompt \u00b7 Perseverance & Resilience',
    promptText: "What has been your biggest failure?",
    questionUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/LPD%203.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvTFBEIDMubXA0IiwiaWF0IjoxNzc2MTUzOTc3LCJleHAiOjIwOTE1MTM5Nzd9.p_38RfU53Quq0OaoS2J9UAbeieUrYSvXC9uW3M9idpU',
    responseUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/failure.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvZmFpbHVyZS5tcDQiLCJpYXQiOjE3NzYxNTQwMzAsImV4cCI6MjA5MTUxNDAzMH0.jyjAaumSYPWORh7WRGWrpSPnnUvvjr75siIwmdpALCc',
    respondentLabel: 'Student',
    captions: [
      { t: 0.7,  text: "When given some thought to this question," },
      { t: 3.6,  text: "I realized I don\u2019t have as many failures" },
      { t: 7.2,  text: "as I would have expected to have." },
      { t: 10.0, text: "And when given the question \u2014 what\u2019s your biggest failure?" },
      { t: 13.6, text: "I think my answer would be" },
      { t: 15.7, text: "not taking enough risks to experience true failure.", accent: true },
      { t: 20.1, text: "I feel like I\u2019ve always been so afraid" },
      { t: 23.1, text: "of facing someone saying no, or facing failures \u2014" },
      { t: 27.5, text: "that I tend to kind of stay in my comfort zone" },
      { t: 33.6, text: "and stand behind the yellow caution tape.", accent: true },
      { t: 34.7, text: "Not letting myself explore the world," },
      { t: 38.5, text: "new challenges, new experiences \u2014" },
      { t: 40.8, text: "because I\u2019m afraid of someone saying no to me.", accent: true },
      { t: 44.6, text: "I feel like that\u2019s a constant battle" },
      { t: 46.3, text: "I\u2019m always trying to combat." },
      { t: 49.3, text: "And I feel like that\u2019s always going to be" },
      { t: 51.7, text: "present throughout the whole of my entire life.", accent: true },
      { t: 54.5, text: "And even taking this course was me" },
      { t: 56.6, text: "stepping out of my comfort zone \u2014" },
      { t: 58.3, text: "letting myself learn with other people," },
      { t: 62.8, text: "letting myself expose myself," },
      { t: 64.4, text: "and talk about my feelings like I am right now.", accent: true },
      { t: 66.6, text: "So I feel like every day I\u2019m trying" },
      { t: 71.8, text: "to expand the barriers of my comfort zone." },
      { t: 74.7, text: "And I\u2019d like to experience a lot more failures", accent: true },
      { t: 79.9, text: "than I am right now." },
    ],
    chips: [
      { t: 3.6,  text: 'Viewpoint Shift',       color: '#60a5fa' },
      { t: 15.7, text: 'Value Statement',       color: '#fbbf24' },
      { t: 20.1, text: 'Vulnerability',         color: '#34d399' },
      { t: 27.5, text: 'Figurative Reasoning',  color: '#818cf8' },
      { t: 40.8, text: 'Risk Aversion',         color: '#fb923c' },
      { t: 54.5, text: 'Courageous Action',     color: '#f472b6' },
      { t: 67.3, text: 'Growth Orientation',    color: '#e879f9' },
      { t: 71.8, text: 'Perseverance',          color: '#38bdf8' },
    ],
    words: [
      {t:0.7,word:'When'},{t:1.4,word:'given'},{t:1.6,word:'some'},{t:1.9,word:'thought'},
      {t:2.2,word:'to'},{t:2.3,word:'this'},{t:3.1,word:'question'},{t:3.6,word:'I'},
      {t:3.6,word:'realized'},{t:4.0,word:'that'},{t:4.4,word:'I'},{t:4.5,word:"don't"},
      {t:4.7,word:'have'},{t:4.9,word:'any'},{t:5.4,word:'as'},{t:6.0,word:'much'},
      {t:6.4,word:'failures'},{t:6.9,word:'as'},{t:7.2,word:'I'},{t:7.3,word:'would'},
      {t:7.5,word:'have'},{t:7.9,word:'expected'},{t:8.3,word:'to'},{t:8.6,word:'have'},
      {t:10.0,word:'And'},{t:10.3,word:'when'},{t:10.6,word:'given'},{t:10.8,word:'the'},
      {t:11.2,word:'question'},{t:12.5,word:"what's"},{t:12.6,word:'your'},{t:12.8,word:'biggest'},
      {t:13.0,word:'failure'},{t:13.6,word:'I'},{t:14.1,word:'think'},{t:14.2,word:'my'},
      {t:14.5,word:'answer'},{t:14.6,word:'would'},{t:14.8,word:'be'},{t:15.7,word:'not'},
      {t:16.0,word:'taking'},{t:16.3,word:'enough'},{t:16.8,word:'risks'},{t:17.2,word:'to'},
      {t:17.7,word:'experience'},{t:18.3,word:'true'},{t:18.9,word:'failure'},{t:19.2,word:'I'},
      {t:20.1,word:'feel'},{t:20.4,word:'like'},{t:20.7,word:"I've"},{t:21.2,word:'always'},
      {t:21.5,word:'been'},{t:21.7,word:'so'},{t:22.1,word:'afraid'},{t:22.4,word:'of'},
      {t:23.1,word:'facing'},{t:23.8,word:'someone'},{t:24.8,word:'saying'},{t:25.1,word:'no'},
      {t:25.5,word:'or'},{t:25.7,word:'facing'},{t:26.0,word:'failures'},{t:26.4,word:'that'},
      {t:27.5,word:'I'},{t:28.0,word:'tend'},{t:28.2,word:'to'},{t:28.8,word:'kind'},
      {t:29.3,word:'of'},{t:29.6,word:'stay'},{t:29.8,word:'in'},{t:30.0,word:'my'},
      {t:30.3,word:'comfort'},{t:30.5,word:'zone'},{t:30.9,word:'and'},{t:31.2,word:'stand'},
      {t:31.5,word:'behind'},{t:32.2,word:'the'},{t:33.6,word:'yellow'},{t:33.9,word:'caution'},
      {t:34.3,word:'tape'},{t:34.5,word:'and'},{t:34.7,word:'not'},{t:34.9,word:'let'},
      {t:35.7,word:'myself'},{t:36.3,word:'explore'},{t:37.1,word:'the'},{t:37.5,word:'world'},
      {t:37.6,word:'or'},{t:37.9,word:'explore'},{t:38.5,word:'new'},{t:39.5,word:'challenges'},
      {t:40.1,word:'new'},{t:40.3,word:'experiences'},{t:40.8,word:'because'},{t:41.4,word:"I'm"},
      {t:41.9,word:'afraid'},{t:42.2,word:'of'},{t:42.8,word:'someone'},{t:43.0,word:'saying'},
      {t:43.2,word:'no'},{t:43.4,word:'to'},{t:43.6,word:'me'},{t:43.9,word:'I'},
      {t:44.6,word:'feel'},{t:44.8,word:'like'},{t:45.0,word:"that's"},{t:45.2,word:'a'},
      {t:45.5,word:'constant'},{t:45.6,word:'battle'},{t:46.0,word:'that'},{t:46.3,word:"I'm"},
      {t:46.9,word:'always'},{t:47.2,word:'trying'},{t:47.5,word:'to'},{t:48.5,word:'combat'},
      {t:48.9,word:'and'},{t:49.3,word:'I'},{t:49.5,word:'feel'},{t:49.5,word:'like'},
      {t:49.7,word:"that's"},{t:49.9,word:'always'},{t:50.2,word:'going'},{t:50.3,word:'to'},
      {t:50.4,word:'be'},{t:50.6,word:'something'},{t:50.8,word:"that's"},{t:51.1,word:'going'},
      {t:51.2,word:'to'},{t:51.4,word:'be'},{t:51.7,word:'present'},{t:52.0,word:'throughout'},
      {t:52.3,word:'the'},{t:52.6,word:'whole'},{t:52.9,word:'of'},{t:53.1,word:'my'},
      {t:53.3,word:'entire'},{t:53.6,word:'life'},{t:54.5,word:'And'},{t:55.0,word:'even'},
      {t:55.1,word:'taking'},{t:55.3,word:'this'},{t:55.6,word:'course'},{t:55.9,word:'was'},
      {t:56.1,word:'me'},{t:56.4,word:'kind'},{t:56.5,word:'of'},{t:56.6,word:'stepping'},
      {t:56.8,word:'out'},{t:56.9,word:'of'},{t:57.0,word:'my'},{t:57.3,word:'comfort'},
      {t:57.5,word:'zone'},{t:57.8,word:'and'},{t:58.3,word:'letting'},{t:58.5,word:'myself'},
      {t:59.0,word:'learn'},{t:59.3,word:'with'},{t:59.5,word:'other'},{t:59.7,word:'people'},
      {t:60.1,word:'and'},{t:60.3,word:'letting'},{t:60.9,word:'myself'},{t:61.5,word:'kind'},
      {t:62.0,word:'of'},{t:62.8,word:'expose'},{t:63.2,word:'myself'},{t:63.8,word:'and'},
      {t:64.4,word:'talk'},{t:64.8,word:'about'},{t:64.9,word:'my'},{t:65.5,word:'feelings'},
      {t:65.5,word:'like'},{t:65.7,word:'I'},{t:65.9,word:'am'},{t:66.0,word:'right'},
      {t:66.2,word:'now'},{t:66.6,word:'So'},{t:67.3,word:'I'},{t:67.5,word:'feel'},
      {t:67.7,word:'like'},{t:68.9,word:'every'},{t:69.5,word:'day'},{t:69.7,word:"I'm"},
      {t:69.9,word:'trying'},{t:70.1,word:'to'},{t:71.8,word:'expand'},{t:71.8,word:'the'},
      {t:72.4,word:'barriers'},{t:72.4,word:'of'},{t:72.7,word:'my'},{t:73.0,word:'comfort'},
      {t:73.3,word:'zone'},{t:74.3,word:'and'},{t:74.7,word:'I'},{t:76.9,word:'like'},
      {t:77.9,word:'to'},{t:78.1,word:'experience'},{t:78.9,word:'a'},{t:79.3,word:'lot'},
      {t:79.4,word:'more'},{t:79.6,word:'failures'},{t:79.9,word:'than'},{t:80.1,word:'I'},
      {t:80.2,word:'am'},{t:80.5,word:'right'},{t:80.9,word:'now'},
    ],
    scoreTimeline: [
      {t:0,score:200},{t:3.2,score:200},
      {t:4.5,score:348},   // jump: Viewpoint Shift (t=3.6)
      {t:9.8,score:348},{t:11.2,score:418}, // jump: Question Framing (t=10.3)
      {t:15.3,score:418},{t:16.8,score:482}, // jump: Value Statement (t=15.7)
      {t:21.6,score:482},{t:23,score:534}, // jump: Emotion+Action Pair (t=22.1)
      {t:27.1,score:534},{t:28.5,score:586}, // jump: Figurative Reasoning (t=27.5)
      {t:40.4,score:586},{t:41.8,score:628}, // jump: Cause-Effect (t=40.8)
      {t:44.2,score:628},{t:45.6,score:668}, // jump: Grit (t=44.6)
      {t:54.1,score:668},{t:55.5,score:712}, // jump: Courageous Action (t=54.5)
      {t:62.4,score:712},{t:63.8,score:742}, // jump: Reciprocity (t=62.8)
      {t:66.9,score:742},{t:68.3,score:764}, // jump: Growth Orientation (t=67.3)
      {t:74.3,score:764},{t:75.7,score:782}, // jump: Persistence (t=74.7)
      {t:80.9,score:780},
    ],
  },
];

// ── Assessment type options ──────────────────────────────────────────────────
const ASSESSMENT_TYPES = [
  {
    id: 'community-schools' as const,
    label: 'Community Schools Survey',
    description: 'Structured voice from students, families, and staff to inform continuous improvement and community planning.',
  },
  {
    id: 'learner-portrait' as const,
    label: 'Learner Portrait',
    description: 'Open-ended voice interviews that surface human skill competencies, strengths, and growth areas for each student.',
  },
  {
    id: 'behavioral-health' as const,
    label: 'Behavioral Health Screener',
    description: 'A voice-based approach to identifying students who may benefit from counseling or intervention.',
  },
];

type AssessmentId = 'community-schools' | 'learner-portrait' | 'behavioral-health';
type AgeGroup = 'Elementary School' | 'Middle School' | 'High School' | 'Parent' | 'Staff';

// ── CS question bank ─────────────────────────────────────────────────────────
const PILLARS: Record<number, string> = {
  1: 'Integrated Student Supports',
  2: 'Active Family & Community Engagement',
  3: 'Collaborative Leadership',
  4: 'Expanded Learning Time',
};

interface CSQ { id: string; def: boolean; age: AgeGroup; p: 1|2|3|4; text: string }
const CS_QUESTIONS: CSQ[] = [
  // Elementary
  {id:'el-1a',def:true, age:'Elementary School',p:1,text:'Think about a time when you needed help at school — like with homework or during a tough day. Who helped you? And what did they do to make you feel better?'},
  {id:'el-1b',def:false,age:'Elementary School',p:1,text:'Imagine a student at your school is struggling with something big. Where could they go for help? How would they know those supports exist?'},
  {id:'el-1c',def:false,age:'Elementary School',p:1,text:'Imagine a student at your school is having a really bad day. Who should they go to for help? What makes that person good at helping students?'},
  {id:'el-2a',def:true, age:'Elementary School',p:2,text:'Think about your HOME — from the food you eat to the things your family likes. What are some things we could do at school that would make it feel more like home?'},
  {id:'el-2b',def:false,age:'Elementary School',p:2,text:'Imagine your family came to school for an event. What would make them feel welcome right away? What might make it harder for families to feel comfortable?'},
  {id:'el-2c',def:false,age:'Elementary School',p:2,text:'Sometimes families and schools work together to help students. What are some ways your school connects with your family? What could make those connections stronger?'},
  {id:'el-3a',def:false,age:'Elementary School',p:3,text:'Tell me about a time when a student idea helped improve something at school or in your classroom. What happened after they shared the idea?'},
  {id:'el-3b',def:true, age:'Elementary School',p:3,text:'Think about a teacher or adult who really listens to students. What do they do that shows they care about student ideas? How does that make students feel?'},
  {id:'el-3c',def:false,age:'Elementary School',p:3,text:"Sometimes students have ideas but don't share them. What might stop students from speaking up? What would help them feel more confident sharing ideas?"},
  {id:'el-4a',def:true, age:'Elementary School',p:4,text:'Think about a time at school when learning felt really fun or exciting. What were you doing? What made that experience special?'},
  {id:'el-4b',def:false,age:'Elementary School',p:4,text:'Imagine you could start a brand-new club or activity at school. What would it be? Why do you think students would enjoy it?'},
  {id:'el-4c',def:false,age:'Elementary School',p:4,text:'Think about something you really love at school — like a fun lesson or a field trip. What else can we do at school to make you more excited to be here?'},
  // Middle School
  {id:'ms-1a',def:false,age:'Middle School',p:1,text:'Think about the different supports at your school, like counselors, teachers, or programs. Which supports actually help students the most? What makes them effective?'},
  {id:'ms-1b',def:false,age:'Middle School',p:1,text:'Tell me about a time when a student needed help at school. Was it easy or hard to get support? What made it that way?'},
  {id:'ms-1c',def:true, age:'Middle School',p:1,text:'Imagine your school could create one new support for students. What should it be? Why would it help students succeed?'},
  {id:'ms-2a',def:false,age:'Middle School',p:2,text:'Think about your family or community outside of school. What is something great about it? How could school connect more with that strength?'},
  {id:'ms-2b',def:true, age:'Middle School',p:2,text:'Sometimes schools invite families to events or activities. What makes those events meaningful for families? What could schools improve?'},
  {id:'ms-2c',def:false,age:'Middle School',p:2,text:'Imagine schools worked more closely with the community. What kinds of partnerships could help students the most? Why?'},
  {id:'ms-3a',def:false,age:'Middle School',p:3,text:'Think about how decisions are made at your school. How can students share their ideas with school leaders? Does it work well?'},
  {id:'ms-3b',def:true, age:'Middle School',p:3,text:'Tell me about a time when students and adults worked together to solve a problem at school. What happened?'},
  {id:'ms-3c',def:false,age:'Middle School',p:3,text:"Sometimes students feel their voices aren't heard. What makes students feel comfortable sharing ideas with adults? What could make it better?"},
  {id:'ms-4a',def:true, age:'Middle School',p:4,text:'Think about an activity, club, or class that helped you discover a new interest. What was it? What made it meaningful?'},
  {id:'ms-4b',def:false,age:'Middle School',p:4,text:'Imagine your school added new opportunities outside regular classes. What kinds of experiences would students care about? Why?'},
  {id:'ms-4c',def:false,age:'Middle School',p:4,text:'Sometimes experiences outside class shape who we become. Tell me about a school activity that helped you grow. What did you learn?'},
  // High School
  {id:'hs-1a',def:true, age:'High School',p:1,text:'Think about the ways your school supports students when life gets difficult. Which supports actually help students the most? Why?'},
  {id:'hs-1b',def:false,age:'High School',p:1,text:"Sometimes students need help but don't ask for it. What barriers might stop students from seeking support? What could schools change?"},
  {id:'hs-1c',def:false,age:'High School',p:1,text:'Imagine you could redesign how schools support student well-being. What would you add or change? Why would it matter?'},
  {id:'hs-2a',def:false,age:'High School',p:2,text:'Think about the role families play in your school community. In what ways are families included in school life? What could make those connections stronger?'},
  {id:'hs-2b',def:true, age:'High School',p:2,text:'Sometimes schools partner with community organizations. What partnerships help students the most? Why?'},
  {id:'hs-2c',def:false,age:'High School',p:2,text:'Imagine schools asked families and communities for more input. What kinds of decisions should families help shape? Why?'},
  {id:'hs-3a',def:false,age:'High School',p:3,text:'Think about a decision at your school that affects students. Should students have more voice in that decision? Why?'},
  {id:'hs-3b',def:false,age:'High School',p:3,text:'Tell me about a time when student feedback led to a real change at school. What made that process work?'},
  {id:'hs-3c',def:true, age:'High School',p:3,text:'Imagine students were true partners in leading your school. What decisions should they help make? What impact would that have?'},
  {id:'hs-4a',def:true, age:'High School',p:4,text:'Think about an experience at school that helped you explore your interests or future goals. What made it meaningful?'},
  {id:'hs-4b',def:false,age:'High School',p:4,text:'Tell me about a program, club, or opportunity that helped you grow the most in school. What did you gain from it?'},
  {id:'hs-4c',def:false,age:'High School',p:4,text:'Imagine your school created new opportunities for students beyond regular classes. What experiences would prepare students best for the future? Why?'},
  // Parent
  {id:'pa-1a',def:true, age:'Parent',p:1,text:'In your experience, when does your child feel most supported, welcomed, or "seen" at school?\n\nWhat do staff or the school do that helps your child feel safe and connected?'},
  {id:'pa-1b',def:false,age:'Parent',p:1,text:'Think about a time when your child needed extra support at school. What support helped the most? What could schools do to make support easier to access?'},
  {id:'pa-1c',def:false,age:'Parent',p:1,text:'Sometimes families need help navigating school resources. What makes it easier for families to find support? What could improve that process?'},
  {id:'pa-1d',def:false,age:'Parent',p:1,text:'Imagine a family whose child is struggling at school. What kinds of school supports would make the biggest difference? Why?'},
  {id:'pa-2a',def:true, age:'Parent',p:2,text:'What is one thing the school does well to partner with families — and one thing the school could do to strengthen communication or connection with you?\n\nThis could include language access, events, updates, relationships, or opportunities to be involved.'},
  {id:'pa-2b',def:false,age:'Parent',p:2,text:"Think about a time when your child's school made you feel welcome. What did they do? What else could schools do to strengthen family involvement?"},
  {id:'pa-2c',def:false,age:'Parent',p:2,text:'Sometimes schools try to build stronger connections with families. What kinds of events or opportunities help families feel included? Why?'},
  {id:'pa-2d',def:false,age:'Parent',p:2,text:'Imagine schools asked families for more input. What kinds of decisions should families help shape?'},
  {id:'pa-3a',def:true, age:'Parent',p:3,text:'If your child is struggling (academically, socially, or emotionally), how confident are you that the school will notice and support them?\n\nWhat helps you feel confident — or what would improve that support?'},
  {id:'pa-3b',def:false,age:'Parent',p:3,text:'Think about how schools gather family feedback. What methods work best? What could make families feel more heard?'},
  {id:'pa-3c',def:false,age:'Parent',p:3,text:'Sometimes families have ideas for improving schools. What makes it easier for families to share those ideas?'},
  {id:'pa-3d',def:false,age:'Parent',p:3,text:'Imagine stronger collaboration between families and school leaders. What would that look like?'},
  {id:'pa-4a',def:true, age:'Parent',p:4,text:'What opportunities (clubs, activities, programs, or experiences) have helped your child feel excited about school — and what opportunities would you like to see more of?'},
  {id:'pa-4b',def:false,age:'Parent',p:4,text:'Think about programs or activities outside regular classes that helped your child grow. What made them meaningful?'},
  {id:'pa-4c',def:false,age:'Parent',p:4,text:'Imagine schools offered more learning opportunities beyond the classroom. What experiences would benefit students most?'},
  {id:'pa-4d',def:false,age:'Parent',p:4,text:'Sometimes enrichment programs shape student interests and future goals. What kinds of opportunities should schools expand?'},
  // Staff
  {id:'st-1a',def:true, age:'Staff',p:1,text:'When a student is struggling (academically, socially, emotionally, or behaviorally), what supports at your site are working well right now — and where do you see gaps or unmet needs?\n\nFeel free to reference systems, referrals, staffing, or day-to-day practices.'},
  {id:'st-1b',def:false,age:'Staff',p:1,text:'Think about a time when a student needed significant support. What systems helped that student most? What gaps still exist?'},
  {id:'st-1c',def:false,age:'Staff',p:1,text:'Sometimes staff coordinate multiple supports for students. What practices make collaboration around student support most effective?'},
  {id:'st-1d',def:false,age:'Staff',p:1,text:'Imagine your school could strengthen one support system for students. What should it be? Why?'},
  {id:'st-2a',def:true, age:'Staff',p:2,text:'How effectively is your school partnering with families right now, and what is one change that would make family engagement more accessible, consistent, or impactful?\n\nExamples: communication, trust-building, language access, events, community partnerships.'},
  {id:'st-2b',def:false,age:'Staff',p:2,text:'Think about a time when families were deeply engaged in school activities. What made that engagement successful?'},
  {id:'st-2c',def:false,age:'Staff',p:2,text:'Sometimes schools struggle to connect with families. What barriers do you see most often? What might help address them?'},
  {id:'st-2d',def:false,age:'Staff',p:2,text:'Imagine stronger partnerships between schools and community organizations. What partnerships would benefit students most?'},
  {id:'st-3a',def:true, age:'Staff',p:3,text:'In what ways do you feel site leadership and staff are aligned around a shared vision for belonging and student wellness — and where could collaboration or shared decision-making be strengthened?'},
  {id:'st-3b',def:false,age:'Staff',p:3,text:'Think about a time when staff input influenced an important decision at your school. What allowed staff voices to shape that decision? What could make that process stronger?'},
  {id:'st-3c',def:false,age:'Staff',p:3,text:'Sometimes staff have ideas for improving school practices or policies. How do staff currently share those ideas with leadership? What helps those ideas actually lead to change?'},
  {id:'st-3d',def:true, age:'Staff',p:3,text:'Imagine a school where staff were true partners in leadership and decision-making. What structures or practices would make staff feel meaningfully included? Where might student voice also fit into that process?'},
  {id:'st-4a',def:false,age:'Staff',p:4,text:'What programs, routines, or learning experiences are most engaging for students at your site — and what enrichment opportunities do you wish students had more access to?'},
  {id:'st-4b',def:false,age:'Staff',p:4,text:'Think about enrichment or extended learning opportunities at your school. Which have the strongest impact on students?'},
  {id:'st-4c',def:false,age:'Staff',p:4,text:'Sometimes schools want to expand learning beyond the classroom. What opportunities would benefit students most?'},
  {id:'st-4d',def:false,age:'Staff',p:4,text:'Imagine you could design one new program that extends learning time for students. What would it be? Why?'},
];

// Non-custom preview URLs per section
const CS_PREVIEWS: Record<string, { videoUrl: string; question: string; pillar: string }> = {
  'Elementary School': {
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/CSA_Elem_Question_1_Integrated_Student_Supports_V3%20(1)%20(1).mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvQ1NBX0VsZW1fUXVlc3Rpb25fMV9JbnRlZ3JhdGVkX1N0dWRlbnRfU3VwcG9ydHNfVjMgKDEpICgxKS5tcDQiLCJpYXQiOjE3NzYxNjAxMzMsImV4cCI6MjA5MTUyMDEzM30.jeeXzp16Mv-6FWmJVhHSUq6ZhAmBdMGOFYMPa2v2yfg',
    pillar: 'Integrated Student Supports',
    question: 'Think of a time someone at school helped you. Who was it, and what did they do?',
  },
  'Middle School': {
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/CSA,_Middle,_Question_1__Integrated_Student_Supports_V2.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvQ1NBLF9NaWRkbGUsX1F1ZXN0aW9uXzFfX0ludGVncmF0ZWRfU3R1ZGVudF9TdXBwb3J0c19WMi5tcDQiLCJpYXQiOjE3NzYxNTg2MDYsImV4cCI6MjA5MTUxODYwNn0._1nXbKzqt3FFbKkG7bf5qKYOomqadL1Dyykojo4-P3E',
    pillar: 'Integrated Student Supports',
    question: 'If your school could create one new support for students, what would it be — and why?',
  },
  'High School': {
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/CSA,_High,_Question_1__Integrated_Student_Supports_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvQ1NBLF9IaWdoLF9RdWVzdGlvbl8xX19JbnRlZ3JhdGVkX1N0dWRlbnRfU3VwcG9ydHNfVjEubXA0IiwiaWF0IjoxNzc2MTU4NjM3LCJleHAiOjIwOTE1MTg2Mzd9.Rx0jPowGfF5co6OzcXNyVrMi034mOcoYUdWKa3S9j6I',
    pillar: 'Integrated Student Supports',
    question: 'When life gets hard, which school supports actually help students the most — and why?',
  },
  'Staff': {
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Staff_Pillar_4_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvU3RhZmZfUGlsbGFyXzRfVjEubXA0IiwiaWF0IjoxNzc2MTU4NjYxLCJleHAiOjIwOTE1MTg2NjF9.klZb_NFoc_IrdlC2c4dReqPowcDwIKQ6K0O_okrtO80',
    pillar: 'Expanded & Enriched Learning Time',
    question: 'What programs or learning experiences engage students most — and what enrichment do you wish they had more access to?',
  },
  'Parent': {
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/CSA,_Parent,_Question_2__Active_Family_%26_Community_Engagement_(1)_V1%20(1).mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvQ1NBLF9QYXJlbnQsX1F1ZXN0aW9uXzJfX0FjdGl2ZV9GYW1pbHlfJl9Db21tdW5pdHlfRW5nYWdlbWVudF8oMSlfVjEgKDEpLm1wNCIsImlhdCI6MTc3NjE1ODY5NSwiZXhwIjoyMDkxNTE4Njk1fQ.6hqsJjJ-1Hd44AGgsa1DL9D96QgMAN6a3Xzq_paeZ5o',
    pillar: 'Active Family & Community Engagement',
    question: 'What does the school do well to partner with families — and what could they do to strengthen communication or connection with you?',
  },
};

// ── Behavioral Health screeners ───────────────────────────────────────────────
interface BHScreener {
  id: string;
  name: string;
  grades: string;
  gradeBands: string[];
  previewUrl: string;
  videoUrl: string;
  videoPillar: string;
  videoQuestion: string;
  questions: Array<{ pillar: string; text: string }>;
}

const BH_SCREENERS: BHScreener[] = [
  {
    id: 'bh-littles',
    name: 'Behavioral Health Screener for Littles',
    grades: 'Grades TK+ (Littles)',
    gradeBands: ['Lower Elementary (TK–2)'],
    previewUrl: 'https://flex.impacterpathway.com/fjzzdvxk8?preview',
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Relational_Awareness_Short_1_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvUmVsYXRpb25hbF9Bd2FyZW5lc3NfU2hvcnRfMV9WMS5tcDQiLCJpYXQiOjE3NzYxNTkyODQsImV4cCI6MjA5MTUxOTI4NH0.zUOwvsrqfqDm977fWtbm5W8nyb1Aw5CMZV5QdMoWnpo',
    videoPillar: 'Relational Awareness',
    videoQuestion: 'Tell me about a time you saw someone who was really upset. What did you notice? What did you do?',
    questions: [
      { pillar: 'Relational Awareness',  text: 'Tell me about a time you saw someone who was really upset. What did you notice? What did you do?' },
      { pillar: 'Emotional Resilience',  text: 'Tell me about a time you kept trying something hard even when you felt like quitting. What happened?' },
      { pillar: 'Effective Help-Seeking', text: 'Tell me about a time you asked someone to help you learn something. Who helped you and how did it go?' },
    ],
  },
  {
    id: 'bh-elementary',
    name: 'Behavioral Health Screener for Elementary',
    grades: 'Grades 3+ (Elementary)',
    gradeBands: ['Elementary (3rd–5th)'],
    previewUrl: 'https://flex.impacterpathway.com/fvtnb1z5e?preview',
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/2_Relational_Awareness_BHS_Elem_Middle_V2.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvMl9SZWxhdGlvbmFsX0F3YXJlbmVzc19CSFNfRWxlbV9NaWRkbGVfVjIubXA0IiwiaWF0IjoxNzc2MTU4OTkwLCJleHAiOjIwOTE1MTg5OTB9.nxQWMJANNfkugCIWwIH-09w4Y9PfGVu6TMKe1hA9-Hg',
    videoPillar: 'Relational Awareness',
    videoQuestion: 'Tell me about a time you noticed how someone else was feeling. What helped you notice, and what did you do?',
    questions: [
      { pillar: 'Reflective Growth',     text: "What's something you're better at now than you used to be? And, what do you think helped you get there?" },
      { pillar: 'Relational Awareness',  text: 'Tell me about a time you noticed how someone else was feeling. What helped you notice, and what did you do?' },
      { pillar: 'Emotional Resilience',  text: 'Tell me about a time something felt really hard, but you kept trying. What did you do to get through it, and what helped you keep going?' },
      { pillar: 'Self-Insight',          text: 'Tell me about a moment when you paused before acting. What were you about to do, what did that feeling inside you tell you, and what did you choose to do next?' },
      { pillar: 'Conflict Resolution',   text: "Tell me about a time someone's feelings were hurt and you tried to help. What did you do to make things better?" },
      { pillar: 'Effective Help-Seeking', text: 'Tell me about a time you were curious about something and wanted to figure it out. What did you do to get help and learn more?' },
    ],
  },
  {
    id: 'bh-secondary',
    name: 'Behavioral Health Screener for Secondary',
    grades: 'Grades 6+ (Secondary)',
    gradeBands: ['Middle School (6th–8th)', 'High School (9th–12th)'],
    previewUrl: 'https://flex.impacterpathway.com/fiucp7xof?preview',
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/High_2_Reflective_Growth_BHS_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvSGlnaF8yX1JlZmxlY3RpdmVfR3Jvd3RoX0JIU19WMS5tcDQiLCJpYXQiOjE3NzYxNTkwMTAsImV4cCI6MjA5MTUxOTAxMH0.UX7OHMWhVs7VWM5JnGs_m9cE8RHrDKu-gmVRKoTn4v0',
    videoPillar: 'Reflective Growth',
    videoQuestion: "How have you grown or changed as a person recently — and what did that experience teach you about yourself?",
    questions: [
      { pillar: 'Reflective Growth',     text: "What is one way you've grown or changed as a person recently? Tell the story of what led to that change, and what the experience helped you understand about yourself." },
      { pillar: 'Relational Awareness',  text: 'Tell me about a specific time when you noticed clues that helped you realize how someone else might be feeling. What did you notice, what did you think might be going on for them, and how did that understanding shape the way you responded?' },
      { pillar: 'Emotional Resilience',  text: 'Tell me about a time when something was genuinely hard and you kept going anyway. What did you do to get through it? What did that experience show you about yourself?' },
      { pillar: 'Self-Insight',          text: 'Tell me about a time when that voice inside your head showed up before you acted. What was happening in that moment, what was that voice telling you, and what did you decide to do next?' },
      { pillar: 'Conflict Resolution',   text: 'Tell me about a time when you tried to improve or repair a difficult situation with someone. What did you do to make things better, and what did that experience help you understand about relationships?' },
      { pillar: 'Effective Help-Seeking', text: 'Tell me about a time when you wanted to understand something better or solve a problem. What steps did you take to figure it out? Who or what did you turn to for help or guidance? And what did that experience teach you about how you learn?' },
    ],
  },
];

// ── Learner Portrait assessments ─────────────────────────────────────────────
interface LPAssessment {
  id: string;
  name: string;
  grades: string;
  gradeBands: string[];
  previewUrl: string;
  videoUrl: string;
  videoPillar: string;
  videoQuestion: string;
}

const LP_ASSESSMENTS: LPAssessment[] = [
  {
    id: 'lp-littles',
    name: 'Learner Portrait for Littles',
    grades: 'Grades TK–2 (Littles)',
    gradeBands: ['Lower Elementary (TK–2)'],
    previewUrl: 'https://sdusd.impacterpathway.com/fp9r1r32y?preview',
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/B1_Q1_Self_Esteem_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvQjFfUTFfU2VsZl9Fc3RlZW1fVjEubXA0IiwiaWF0IjoxNzc2MTU4OTMyLCJleHAiOjIwOTE1MTg5MzJ9.wjme9sEXL6BE6wHleoOcJVbHu8NHADANpGR2BPPIeYA',
    videoPillar: 'Self-Esteem',
    videoQuestion: 'What do you like about yourself and your life?',
  },
  {
    id: 'lp-elementary',
    name: 'Learner Portrait for Elementary',
    grades: 'Grades 3–5 (Elementary)',
    gradeBands: ['Elementary (3rd–5th)'],
    previewUrl: 'https://flex.impacterpathway.com/fn0l89pl3?preview',
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Q1_Curiosity_Benchmark_1_V2_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvUTFfQ3VyaW9zaXR5X0JlbmNobWFya18xX1YyX1YxLm1wNCIsImlhdCI6MTc3NjE1OTUzNywiZXhwIjoyMDkxNTE5NTM3fQ.xVyDgNSYqwDgM8vBaNKAwuqvTAAKbDa38tOg8rDCYhA',
    videoPillar: 'Curiosity',
    videoQuestion: 'What have you noticed that made you curious? What did it make you wonder?',
  },
  {
    id: 'lp-secondary',
    name: 'Learner Portrait for Secondary',
    grades: 'Grades 6–12 (Secondary)',
    gradeBands: ['Middle School (6th–8th)', 'High School (9th–12th)'],
    previewUrl: 'https://flex.impacterpathway.com/fwxzy777r?preview',
    videoUrl: 'https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Video_8_3_6_Perspective_Taking_Benchmark_4_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvVmlkZW9fOF8zXzZfUGVyc3BlY3RpdmVfVGFraW5nX0JlbmNobWFya180X1YxLm1wNCIsImlhdCI6MTc3NjE1OTU1MywiZXhwIjoyMDkxNTE5NTUzfQ.MRunPK0ka9a2Oi6f1ieMWD2fz3ZKgMQBt1Ik_Lpf6F0',
    videoPillar: 'Perspective-Taking',
    videoQuestion: 'Tell us about a time when you were super annoyed with someone... until you learned their side of the story.',
  },
];

interface LPQuestion { id: string; band: string; attribute: string; prompt: string; def: boolean }
const LP_QUESTIONS: LPQuestion[] = [
  // ── Lower Elementary ────────────────────────────────────────────────────────
  { id: 'le-1', band: 'lp-littles', attribute: 'Self-Esteem',  prompt: 'What do you like about yourself and your life?', def: true },
  { id: 'le-2', band: 'lp-littles', attribute: 'Belonging',    prompt: 'Do your friends make you feel good when you get the right answers in class? What do they say or do?', def: true },
  { id: 'le-3', band: 'lp-littles', attribute: 'Empathy',      prompt: 'Share about a time when you helped someone who was feeling sad, scared, or upset. What did you do to help them?', def: true },
  { id: 'le-4', band: 'lp-littles', attribute: 'Curiosity',    prompt: 'Share about a time you had a question you wanted to ask in front of other people. Did you ask it? Why or why not?', def: false },
  { id: 'le-5', band: 'lp-littles', attribute: 'Resilience',   prompt: 'Share about a time when you kept trying to do something even though it was hard. Why did you keep trying?', def: false },
  { id: 'le-6', band: 'lp-littles', attribute: 'Self-Control', prompt: "What would you do if you were left with a pile of M&M's and you were told not to eat any of them?", def: false },
  // ── Elementary ──────────────────────────────────────────────────────────────
  { id: 'el-1',  band: 'lp-elementary', attribute: 'Curiosity',          prompt: 'What have you noticed that made you curious? What did it make you wonder?', def: true },
  { id: 'el-2',  band: 'lp-elementary', attribute: 'Curiosity',          prompt: 'What would you like to try doing differently? What makes you curious about trying it that way?', def: false },
  { id: 'el-3',  band: 'lp-elementary', attribute: 'Perspective-Taking', prompt: "Tell us about a moment when seeing things from someone else's point of view changed your mind about something.", def: true },
  { id: 'el-4',  band: 'lp-elementary', attribute: 'Perspective-Taking', prompt: 'If you could show others the world through your eyes, what would you want them to see?', def: false },
  { id: 'el-5',  band: 'lp-elementary', attribute: 'Purpose',            prompt: 'Share something you love doing that just feels exactly right for you.', def: false },
  { id: 'el-6',  band: 'lp-elementary', attribute: 'Purpose',            prompt: 'Share something you spend hours on because it matters that much to you.', def: false },
  { id: 'el-7',  band: 'lp-elementary', attribute: 'Self-Control',       prompt: 'Describe a time when you were nervous and had to calm yourself down.', def: true },
  { id: 'el-8',  band: 'lp-elementary', attribute: 'Self-Control',       prompt: 'Tell us about a time when you had to be patient even though you were really excited.', def: false },
  { id: 'el-9',  band: 'lp-elementary', attribute: 'Grit',               prompt: 'Describe a time when you tried to learn something challenging.', def: false },
  { id: 'el-10', band: 'lp-elementary', attribute: 'Grit',               prompt: 'Describe something you would love to get really good at through lots of practice.', def: false },
  { id: 'el-11', band: 'lp-elementary', attribute: 'Growth Mindset',     prompt: 'Share a time when believing you could improve helped you get better at something.', def: true },
  { id: 'el-12', band: 'lp-elementary', attribute: 'Growth Mindset',     prompt: 'Share a time when believing in each other helped your group or team grow and improve.', def: false },
  { id: 'el-13', band: 'lp-elementary', attribute: 'Compassion',         prompt: "Share a time when you showed compassion to someone who couldn't ask for help.", def: false },
  { id: 'el-14', band: 'lp-elementary', attribute: 'Compassion',         prompt: 'Tell us about a time when you saw something wrong and decided whether or not to step in.', def: true },
  { id: 'el-15', band: 'lp-elementary', attribute: 'Gratitude',          prompt: 'Tell us who inspires you and why you want to thank them.', def: true },
  { id: 'el-16', band: 'lp-elementary', attribute: 'Gratitude',          prompt: 'Tell us about a time when you joined others to show someone they were appreciated.', def: false },
  // ── Secondary ───────────────────────────────────────────────────────────────
  { id: 'sec-1',  band: 'lp-secondary', attribute: 'Curiosity',          prompt: 'Tell us about a problem you tried to solve. What did you try? Did it work?', def: true },
  { id: 'sec-2',  band: 'lp-secondary', attribute: 'Curiosity',          prompt: 'What simple task would you like to make more interesting? How would you do it?', def: false },
  { id: 'sec-3',  band: 'lp-secondary', attribute: 'Perspective-Taking', prompt: 'Tell us about a time when you were super annoyed with someone... until you learned their side of the story.', def: true },
  { id: 'sec-4',  band: 'lp-secondary', attribute: 'Perspective-Taking', prompt: "Share a time when you kept your cool and considered another person's perspective.", def: false },
  { id: 'sec-5',  band: 'lp-secondary', attribute: 'Purpose',            prompt: 'Share a time when doing something important helped you become more confident in who you are.', def: false },
  { id: 'sec-6',  band: 'lp-secondary', attribute: 'Purpose',            prompt: 'Share a time when you played an important part in something bigger than yourself.', def: false },
  { id: 'sec-7',  band: 'lp-secondary', attribute: 'Self-Control',       prompt: 'Tell us about a time when you kept your cool even though someone was trying to upset you.', def: false },
  { id: 'sec-8',  band: 'lp-secondary', attribute: 'Self-Control',       prompt: "Tell us about a time when you were tempted to do something you knew wasn't right. How did you handle it?", def: true },
  { id: 'sec-9',  band: 'lp-secondary', attribute: 'Grit',               prompt: 'Tell us about a time when failing made you try even harder.', def: false },
  { id: 'sec-10', band: 'lp-secondary', attribute: 'Grit',               prompt: 'Tell us about a big project you refused to give up on.', def: true },
  { id: 'sec-11', band: 'lp-secondary', attribute: 'Growth Mindset',     prompt: "Share one specific way you could help change something people say \"can't change.\"", def: false },
  { id: 'sec-12', band: 'lp-secondary', attribute: 'Growth Mindset',     prompt: 'Share how you transformed something ordinary into something special.', def: false },
  { id: 'sec-13', band: 'lp-secondary', attribute: 'Compassion',         prompt: 'Share one specific way you showed (or could have shown) compassion to someone who was struggling in your group.', def: false },
  { id: 'sec-14', band: 'lp-secondary', attribute: 'Compassion',         prompt: 'Share a time when you showed kindness to someone from "another group."', def: true },
  { id: 'sec-15', band: 'lp-secondary', attribute: 'Gratitude',          prompt: 'Tell us about a way you could show gratitude without using words.', def: false },
  { id: 'sec-16', band: 'lp-secondary', attribute: 'Gratitude',          prompt: 'Tell us about a time when gratitude made you feel more emotion than you expected to feel.', def: true },
];

interface LPAttribute { id: string; name: string; group: 'anchor' | 'portrait'; questionIds: string[] }
const LP_ATTRIBUTES: LPAttribute[] = [
  // ── Impacter Anchor Attributes ───────────────────────────────────────────────
  { id: 'anc-curiosity',     name: 'Curiosity',            group: 'anchor',   questionIds: ['el-1','el-2','sec-1','sec-2'] },
  { id: 'anc-perspective',   name: 'Perspective-Taking',   group: 'anchor',   questionIds: ['el-3','el-4','sec-3','sec-4'] },
  { id: 'anc-purpose',       name: 'Purpose',              group: 'anchor',   questionIds: ['el-5','el-6','sec-5','sec-6'] },
  { id: 'anc-self-control',  name: 'Self-Control',         group: 'anchor',   questionIds: ['el-7','el-8','sec-7','sec-8'] },
  { id: 'anc-grit',          name: 'Grit',                 group: 'anchor',   questionIds: ['el-9','el-10','sec-9','sec-10'] },
  { id: 'anc-growth',        name: 'Growth Mindset',       group: 'anchor',   questionIds: ['el-11','el-12','sec-11','sec-12'] },
  { id: 'anc-compassion',    name: 'Compassion',           group: 'anchor',   questionIds: ['el-13','el-14','sec-13','sec-14'] },
  { id: 'anc-gratitude',     name: 'Gratitude',            group: 'anchor',   questionIds: ['el-15','el-16','sec-15','sec-16'] },
  // ── Other Common Portrait Competencies ──────────────────────────────────────
  { id: 'pog-critical',      name: 'Critical Thinking',                    group: 'portrait', questionIds: ['el-1','sec-1','sec-2','sec-11','sec-12'] },
  { id: 'pog-problem',       name: 'Problem-Solving',                      group: 'portrait', questionIds: ['sec-1','sec-2','el-9','sec-10','sec-11'] },
  { id: 'pog-communication', name: 'Communication',                         group: 'portrait', questionIds: ['el-4','sec-4','el-13','sec-13'] },
  { id: 'pog-character',     name: 'Character',                             group: 'portrait', questionIds: ['sec-8','el-13','el-14','sec-13','sec-14','el-15','el-16','sec-15','sec-16','sec-5','sec-6'] },
  { id: 'pog-perseverance',  name: 'Perseverance/Adaptability',             group: 'portrait', questionIds: ['el-9','sec-9','sec-10','el-7','el-8','el-11'] },
  { id: 'pog-collaboration', name: 'Collaboration',                         group: 'portrait', questionIds: ['el-12','sec-13','sec-14','el-16','sec-6'] },
  { id: 'pog-global',        name: 'Global Citizenship',                    group: 'portrait', questionIds: ['el-3','el-4','sec-14','sec-6'] },
  { id: 'pog-creativity',    name: 'Creativity',                            group: 'portrait', questionIds: ['el-2','sec-2','sec-12'] },
  { id: 'pog-health',        name: 'Health and Wellness',                   group: 'portrait', questionIds: ['el-7','el-8','sec-16','el-5'] },
  { id: 'pog-self-aware',    name: 'Self-Awareness',                        group: 'portrait', questionIds: ['el-5','el-6','sec-5','el-7','el-11','sec-16'] },
  { id: 'pog-academic',      name: 'Academic Proficiency',                  group: 'portrait', questionIds: ['el-9','el-10'] },
  { id: 'pog-self-dir',      name: 'Self-Direction',                        group: 'portrait', questionIds: ['el-5','el-6','sec-5','el-10','sec-10','sec-8','el-2'] },
  { id: 'pog-college',       name: 'College and Career Navigation',         group: 'portrait', questionIds: ['el-5','el-6','sec-5','sec-6','el-10'] },
  { id: 'pog-leadership',    name: 'Leadership',                            group: 'portrait', questionIds: ['el-12','sec-11','el-14','sec-6'] },
  { id: 'pog-interpersonal', name: 'Interpersonal Understanding',           group: 'portrait', questionIds: ['el-3','sec-3','sec-4','el-13','sec-13','sec-14','el-15','el-16'] },
  { id: 'pog-organization',  name: 'Organization',                          group: 'portrait', questionIds: ['el-8','sec-10'] },
  { id: 'pog-independent',   name: 'Ability to Work Independently',         group: 'portrait', questionIds: ['el-9','el-10','sec-9','sec-10','el-7','sec-8','sec-5'] },
];

function getCrosswalks(qId: string): string[] {
  return LP_ATTRIBUTES.filter(a => a.group === 'portrait' && a.questionIds.includes(qId)).map(a => a.name);
}

function SaveForLaterModal({ id, onClose }: { id: string; onClose: () => void }) {
  const isCS = id.startsWith('cs-');
  const csKey = isCS ? id.slice(3) as AgeGroup : null;
  const lpA = LP_ASSESSMENTS.find(a => a.id === id);
  const bhS = BH_SCREENERS.find(s => s.id === id);
  const csLabel: Record<string, string> = { 'Elementary School': 'Elementary School', 'Middle School': 'Middle School', 'High School': 'High School', 'Parent': 'Parent / Family', 'Staff': 'Staff' };
  const name = lpA?.name ?? bhS?.name ?? (csKey ? `Community Schools Survey — ${csLabel[csKey] ?? csKey}` : '');
  const grades = lpA?.grades ?? bhS?.grades ?? (csKey ? 'Community Schools Assessment' : '');
  const isLittles = id === 'lp-littles';

  function downloadPDF() {
    const el = document.getElementById('sfl-doc');
    if (!el) return;
    const win = window.open('', '_blank', 'width=860,height=1000');
    if (!win) return;
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + name + '</title><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"DM Sans",Arial,sans-serif;color:#1a2744;margin:0;padding:40px 48px;max-width:700px;line-height:1.5}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>' + el.innerHTML + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  const allLPQs = lpA ? LP_QUESTIONS.filter(q => q.band === id) : [];
  const standardLPQs = allLPQs.filter(q => q.def);
  const optionalLPQs = allLPQs.filter(q => !q.def);
  const lpAttrOrder = Array.from(new Set(allLPQs.map(q => q.attribute)));
  const csQsByPillar = csKey ? ([1,2,3,4] as const).map(p => ({
    pillar: p, label: PILLARS[p], standard: CS_QUESTIONS.filter(q => q.age === csKey && q.p === p && q.def), optional: CS_QUESTIONS.filter(q => q.age === csKey && q.p === p && !q.def),
  })) : [];

  const divider = (label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4a6fa5', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
    </div>
  );

  const qRow = (q: LPQuestion) => {
    const cws = getCrosswalks(q.id);
    return (
      <div key={q.id} style={{ borderLeft: '3px solid #dce8f5', paddingLeft: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: cws.length ? 5 : 0 }}>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: 0 }}>{q.prompt}</p>
        </div>
        {cws.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', overflow: 'hidden' }}>
            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>Also measures:</span>
            {cws.map(cw => <span key={cw} style={{ fontSize: 8, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '2px 6px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{cw}</span>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,20,40,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'white', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

        {/* Modal header */}
        <div style={{ padding: '16px 24px', background: '#1a2744', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Save for Later</p>
            <h2 style={{ color: 'white', fontSize: 15, fontWeight: 700, margin: '2px 0 0', lineHeight: 1.3 }}>{name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'white', background: '#e07b54', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download PDF
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}>✕</button>
          </div>
        </div>

        {/* Scrollable document */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: '#f4f7fc' }}>
          <div id="sfl-doc" style={{ background: 'white', borderRadius: 12, padding: '40px 48px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', maxWidth: 660, margin: '0 auto' }}>

            {/* Document header */}
            <div style={{ background: '#1a2744', borderRadius: 10, padding: '24px 28px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 4px', lineHeight: 1.2 }}>{name}</h1>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{grades}</p>
              </div>
              <img src="/Logo_Transparent_Background.png" alt="Impacter Pathway" style={{ height: 64, objectFit: 'contain', flexShrink: 0 }} />
            </div>

            {/* Intro */}
            <div style={{ borderLeft: '3px solid #4a6fa5', paddingLeft: 16, marginBottom: 32 }}>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>
                Thank you for your interest in the <strong>{name}</strong>. Below is a complete overview of the questions available for this assessment: what they measure, how they&apos;re structured, and the different ways you can make them your own.
              </p>
            </div>

            {/* LP content */}
            {lpA && (
              <>
                {/* Options — shown first */}
                <div style={{ marginBottom: 28 }}>
                  {divider('Your Options')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Standard',       color: '#15803d', bg: '#f0fdf4', desc: 'Our curated set of recommended prompts, ready to deploy as-is.' },
                      { label: 'Custom',          color: '#1d4ed8', bg: '#eff6ff', desc: isLittles ? 'Pick one question per competency from our full question bank.' : 'Pick one question per competency from our full question bank.' },
                      { label: 'Build Your Own',  color: '#7c3aed', bg: '#faf5ff', desc: "We'll co-design a new assessment with custom questions with your team." },
                    ].map(opt => (
                      <div key={opt.label} style={{ background: opt.bg, borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: opt.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{opt.label}</p>
                        <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {[
                  { label: 'Standard Questions', qs: standardLPQs },
                  { label: 'From the Question Bank', qs: optionalLPQs },
                ].filter(s => s.qs.length > 0).map(section => (
                  <div key={section.label} style={{ marginBottom: 28 }}>
                    {divider(section.label)}
                    {lpAttrOrder.map(attr => {
                      const qs = section.qs.filter(q => q.attribute === attr);
                      if (!qs.length) return null;
                      return (
                        <div key={attr} style={{ marginBottom: 18 }}>
                          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#4a6fa5', background: '#eff6ff', padding: '3px 10px', borderRadius: 6, marginBottom: 10 }}>{attr}</span>
                          {qs.map(q => qRow(q))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}

            {/* BH content */}
            {bhS && (
              <div style={{ marginBottom: 28 }}>
                {divider('Assessment Questions')}
                {bhS.questions.map((q, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #dce8f5', paddingLeft: 14, marginBottom: 14 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6fa5', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>{q.pillar}</p>
                    <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: 0 }}>{q.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CS content */}
            {isCS && (
              <>
                {/* Options */}
                <div style={{ marginBottom: 28 }}>
                  {divider('Your Options')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Standard',       color: '#15803d', bg: '#f0fdf4', desc: 'Our recommended question per pillar, ready to deploy as-is.' },
                      { label: 'Custom',          color: '#1d4ed8', bg: '#eff6ff', desc: 'Pick one question per pillar from our full question bank.' },
                      { label: 'Build Your Own',  color: '#7c3aed', bg: '#faf5ff', desc: "We'll co-design a new assessment with custom questions with your team." },
                    ].map(opt => (
                      <div key={opt.label} style={{ background: opt.bg, borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: opt.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{opt.label}</p>
                        <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Standard questions by pillar */}
                <div style={{ marginBottom: 28 }}>
                  {divider('Standard Questions')}
                  {csQsByPillar.map(({ pillar, label: pillarLabel, standard }) => (
                    <div key={pillar} style={{ marginBottom: 18 }}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#4a6fa5', background: '#eff6ff', padding: '3px 10px', borderRadius: 6, marginBottom: 10 }}>Pillar {pillar}: {pillarLabel}</span>
                      {standard.map(q => (
                        <div key={q.id} style={{ borderLeft: '3px solid #dce8f5', paddingLeft: 14, marginBottom: 10 }}>
                          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: 0 }}>{q.text}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* From the question bank */}
                <div style={{ marginBottom: 28 }}>
                  {divider('From the Question Bank')}
                  {csQsByPillar.map(({ pillar, label: pillarLabel, optional }) => optional.length > 0 && (
                    <div key={pillar} style={{ marginBottom: 18 }}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#4a6fa5', background: '#eff6ff', padding: '3px 10px', borderRadius: 6, marginBottom: 10 }}>Pillar {pillar}: {pillarLabel}</span>
                      {optional.map(q => (
                        <div key={q.id} style={{ borderLeft: '3px solid #dce8f5', paddingLeft: 14, marginBottom: 10 }}>
                          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: 0 }}>{q.text}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Custom note */}
            <div style={{ background: '#fef9f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 18px' }}>
              <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.65 }}>
                <strong>Not seeing exactly what you need?</strong> We also offer fully custom question design, built from scratch around your school&apos;s specific goals, context, and community. Reach out to talk through what&apos;s possible at <a href="mailto:info@impacterpathway.com" style={{ color: '#92400e' }}>info@impacterpathway.com</a>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

interface FormData {
  assessmentType: AssessmentId | '';
  // Step 2: Timing
  launchTimeline: string;
  dateNotes: string;
  onsiteSupport: 'yes' | 'no' | 'unsure' | null;
  wantsCustomIntro: 'yes' | 'no' | 'unsure' | null;
  // Step 3: Contextual
  respondents: string[];
  gradeLevels: string[];
  expectedCount: string;
  languages: string[];
  otherLanguage: string;
  modalities: string[];
  // Community Schools specific
  communityModel: string;
  primaryGoal: string;
  primaryGoalOther: string;
  // Learner Portrait specific
  competencyFocus: string;
  // Behavioral Health specific
  screeningScope: string;
  bhSelectedAssessments: string[];
  bhWantsCustom: boolean;
  // Learner Portrait specific
  lpSelectedAssessments: string[];
  lpWantsCustom: boolean;
  // Demographics opt-in
  demographics: string[];
  demographicsOther: string;
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
  launchTimeline: '',
  dateNotes: '',
  onsiteSupport: null,
  wantsCustomIntro: null,
  respondents: [],
  gradeLevels: [],
  expectedCount: '',
  languages: ['English'],
  otherLanguage: '',
  modalities: [],
  communityModel: '',
  primaryGoal: '',
  primaryGoalOther: '',
  competencyFocus: '',
  screeningScope: '',
  bhSelectedAssessments: [],
  bhWantsCustom: false,
  lpSelectedAssessments: [],
  lpWantsCustom: false,
  demographics: [],
  demographicsOther: '',
  name: '',
  email: '',
  role: '',
  organization: '',
  phone: '',
  notes: '',
};

const GRADE_BANDS = [
  'Lower Elementary (TK–2)',
  'Elementary (3+)',
  'Middle (6+)',
  'High (9+)',
];

const BAND_TO_INTERNAL: Record<string, string> = {
  'Lower Elementary (TK–2)': 'Lower Elementary (TK–2)',
  'Elementary (3+)':          'Elementary (3rd–5th)',
  'Middle (6+)':              'Middle School (6th–8th)',
  'High (9+)':                'High School (9th–12th)',
};

function getGradeBands(gradeLevels: string[]): Set<string> {
  return new Set(gradeLevels.map(l => BAND_TO_INTERNAL[l]).filter(Boolean) as string[]);
}

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
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label.endsWith(' *') ? <>{label.slice(0, -2)}<span className="text-red-500 ml-0.5">*</span></> : label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value.includes(opt)
                ? 'text-white border-[#4a6fa5]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#4a6fa5]/40'
            }`}
            style={value.includes(opt) ? { background: '#4a6fa5' } : undefined}
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

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4a6fa5]/40 bg-white';
const SELECT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4a6fa5]/40 bg-white text-gray-700';



function VideoChrome({ curT, dur, fmt }: { curT: number; dur: number; fmt: (t: number) => string }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'rgba(0,0,0,0.55)', zIndex: 4, pointerEvents: 'none' }}>
      <span style={{ color: 'white', fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>{fmt(curT)} / {fmt(dur)}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {/* Back */}
        <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </span>
        {/* CC */}
        <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 5px', color: 'white', fontSize: 8.5, fontWeight: 700 }}>CC</span>
        {/* 1x */}
        <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 5px', color: 'white', fontSize: 8.5, fontWeight: 700 }}>1x</span>
        {/* Expand */}
        <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </span>
      </div>
    </div>
  );
}

function IntroVideoPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [curT, setCurT] = useState(0);
  const [dur, setDur] = useState(0);
  const [hov, setHov] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.src = src;
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    video.onloadedmetadata = () => setDur(video.duration);
    video.ontimeupdate = () => setCurT(video.currentTime);
    video.onended = () => { if (mutedRef.current) { video.play().catch(() => {}); } else { setPaused(true); } };
    container.appendChild(video);
    ref.current = video;
    const tryPlay = () => video.play().catch(() => {});
    video.addEventListener('canplay', tryPlay, { once: true });
    tryPlay();
    const retryOnInteract = () => { if (video.paused) video.play().catch(() => {}); };
    document.addEventListener('click', retryOnInteract, { once: true });
    return () => {
      document.removeEventListener('click', retryOnInteract);
      if (container.contains(video)) container.removeChild(video);
    };
  }, [src]);

  function toggle() {
    const el = ref.current; if (!el) return;
    if (muted) { el.currentTime = 0; el.muted = false; el.volume = 1; mutedRef.current = false; setMuted(false); el.play(); setPaused(false); }
    else if (el.paused) { el.play(); setPaused(false); }
    else { el.pause(); setPaused(true); }
  }
  function fmt(t: number) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2, '0')}`; }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#03568C', display: 'flex', height: 220 }}>
      {/* Left: video (60%) */}
      <div
        style={{ flex: '0 0 60%', position: 'relative', background: '#000', overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={toggle}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <VideoChrome curT={curT} dur={dur} fmt={fmt} />
        {muted && (
          <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: 'white', fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em' }}>Tap for sound</span>
          </div>
        )}
        {/* Play/pause button */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s', opacity: (paused && !muted) || hov ? 1 : 0, pointerEvents: 'none' }}>
          {paused
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#03568C"><path d="M8 5v14l11-7z"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="#03568C"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          }
        </div>
      </div>
      {/* Right: Begin */}
      <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#03568C' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, margin: 0, textAlign: 'center' }}>Ready to begin?</p>
        <button style={{ background: '#598DAD', color: 'white', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'default', width: '100%', letterSpacing: '0.04em' }}>
          Begin
        </button>
      </div>
    </div>
  );
}

function CSVideoPlayer({ src, question, pillar }: { src: string; question: string; pillar: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [curT, setCurT] = useState(0);
  const [dur, setDur] = useState(0);
  const [hov, setHov] = useState(false);
  const isAudio = /\.mp3($|\?)/.test(src);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isAudio) return;
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.src = src;
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    video.onloadedmetadata = () => setDur(video.duration);
    video.ontimeupdate = () => setCurT(video.currentTime);
    video.onended = () => { if (mutedRef.current) { video.play().catch(() => {}); } else { setPaused(true); } };
    container.appendChild(video);
    ref.current = video;
    const tryPlay = () => video.play().catch(() => {});
    video.addEventListener('canplay', tryPlay, { once: true });
    tryPlay();
    return () => { if (container.contains(video)) container.removeChild(video); };
  }, [src, isAudio]);

  function toggle() {
    const el = ref.current; if (!el) return;
    if (muted && !isAudio) { el.currentTime = 0; el.muted = false; el.volume = 1; mutedRef.current = false; setMuted(false); el.play(); setPaused(false); }
    else if (el.paused) { el.play(); setPaused(false); }
    else { el.pause(); setPaused(true); }
  }
  function fmt(t: number) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${String(m).padStart(2,'0')}:${String(s).padStart(2, '0')}`; }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#03568C', display: 'flex', height: 220 }}>
      {/* Left: video (60%) */}
      <div
        style={{ flex: '0 0 60%', position: 'relative', background: '#000', overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={toggle}
      >
        {isAudio ? (
          <div style={{ position: 'absolute', inset: 0, background: '#03568C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
        ) : (
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        )}
        <VideoChrome curT={curT} dur={dur} fmt={fmt} />
        {muted && !isAudio && (
          <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
            <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: 'white', fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em' }}>Tap for sound</span>
          </div>
        )}
        {/* Question text overlaid on video */}
        <div style={{ position: 'absolute', top: 32, left: 0, right: 0, bottom: 0, padding: '10px 14px 0', pointerEvents: 'none', zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'white', lineHeight: 1.35, margin: 0, textShadow: '0 1px 10px rgba(0,0,0,0.6)', fontFamily: "'Apercu Pro', 'Apercu', 'DM Sans', sans-serif" }}>{question}</p>
        </div>
        {/* Play/pause button */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s', opacity: (paused && !muted) || hov ? 1 : 0, pointerEvents: 'none', zIndex: 3 }}>
          {paused
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#03568C"><path d="M8 5v14l11-7z"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="#03568C"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          }
        </div>
      </div>
      {/* Right: response options (40%) */}
      <div style={{ flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#03568C' }}>
        <p style={{ color: 'white', fontSize: 11, fontWeight: 600, margin: 0, textAlign: 'center' }}>How would you like to answer?</p>
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
          {([
            { label: 'VIDEO', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/></svg> },
            { label: 'AUDIO', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10a7 7 0 0 1-14 0" fill="none" stroke="white" strokeWidth="2"/><line x1="12" y1="17" x2="12" y2="20" stroke="white" strokeWidth="2"/></svg> },
            { label: 'TEXT', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 9h8M12 9v6" fill="none" stroke="#598DAD" strokeWidth="2" strokeLinecap="round"/></svg> },
          ] as const).map(({ label, icon }) => (
            <div key={label} style={{ background: '#598DAD', borderRadius: 8, padding: '10px 8px 7px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
              {icon}
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
            </div>
          ))}
        </div>
        <p style={{ color: '#FFB547', fontSize: 9.5, fontWeight: 500, margin: 0, textAlign: 'center' }}>🔥 You can practice before sending</p>
      </div>
    </div>
  );
}

function ContinueBtn({ reason, onClick }: { reason: string | null; onClick: () => void }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} className="group">
      <button
        disabled={!!reason}
        onClick={onClick}
        className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ background: '#4a6fa5' }}
      >
        Continue
      </button>
      {reason && (
        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, zIndex: 50, pointerEvents: 'none' }}
          className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div style={{ background: '#111827', color: 'white', fontSize: 12, borderRadius: 8, padding: '7px 11px', maxWidth: 230, whiteSpace: 'normal', lineHeight: 1.45, textAlign: 'left' }}>
            {reason}
          </div>
          <div style={{ position: 'absolute', bottom: -4, right: 18, width: 8, height: 8, background: '#111827', transform: 'rotate(45deg)' }} />
        </div>
      )}
    </div>
  );
}

export default function PilotClient({ initialOpen = false }: { initialOpen?: boolean }) {
  const [formOpen, setFormOpen] = useState(initialOpen);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: '', email: '', org: '', phone: '', notes: '' });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [step, setStep] = useState<1|2|3|4|5|6|7>(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [previewModal, setPreviewModal] = useState<{ label: string; url: string } | null>(null);
  // CS question selector state
  const [csMode, setCsMode] = useState<Record<string, 'standard'|'custom'|'write-own'>>({});
  const [csPicks, setCsPicks] = useState<Record<string, Record<number, string>>>({});
  const [csPreviewLang, setCsPreviewLang] = useState<Record<string, 'en'|'es'>>({});
  const [csPreviewOpen, setCsPreviewOpen] = useState<Record<string, boolean>>({});
  // LP question selector state
  const [lpMode, setLpMode] = useState<Record<string, 'standard'|'custom'|'write-own'>>({});
  const [lpPicks, setLpPicks] = useState<Record<string, string[]>>({});       // littles question picks
  const [lpAttrPicks, setLpAttrPicks] = useState<Record<string, string[]>>({}); // el/sec attribute picks
  const [lpQPicks, setLpQPicks] = useState<Record<string, string[]>>({});       // el/sec question picks
  const [previewIndex, setPreviewIndex] = useState(0);
  const [panelIndex, setPanelIndex] = useState(0);
  const [simShown, setSimShown] = useState(false);
  const [promptPaused, setPromptPaused] = useState(false);
  const [promptMuted, setPromptMuted] = useState(true);
  const [responsePaused, setResponsePaused] = useState(false);
  const [responseEnded, setResponseEnded] = useState(false);
  const [promptHovered, setPromptHovered] = useState(false);
  const [responseHovered, setResponseHovered] = useState(false);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [chipIdx, setChipIdx] = useState(-1);
  const [promptCurrentTime, setPromptCurrentTime] = useState(0);
  const [promptDuration, setPromptDuration] = useState(0);
  const [responseCurrentTime, setResponseCurrentTime] = useState(0);
  const [responseDuration, setResponseDuration] = useState(0);
  const [wordIdx, setWordIdx] = useState(-1);
  const [currentScore, setCurrentScore] = useState(DEMO_PANELS[0].scoreTimeline[0].score);
  const promptVideoRef = useRef<HTMLVideoElement | null>(null);
  const promptContainerRef = useRef<HTMLDivElement>(null);
  const promptMutedRef = useRef(true);
  const responseVideoRef = useRef<HTMLVideoElement>(null);
  const panel = DEMO_PANELS[panelIndex];
  const [bhHover, setBhHover] = useState<number | null>(null);
  const [hmHover, setHmHover] = useState<{ r: number; c: number } | null>(null);
  const [csHover, setCsHover] = useState<number | null>(null);
  const [toneHover, setToneHover] = useState<number | null>(null);
  const [demoPanel, setDemoPanel] = useState(0);
  const [demoPaused, setDemoPaused] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sflId, setSflId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (demoPaused) return;
    const t = setInterval(() => setDemoPanel(p => (p + 1) % 3), 4000);
    return () => clearInterval(t);
  }, [demoPaused]);

  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  // Lock body scroll when the form overlay is open so the window doesn't
  // show a second scrollbar behind the fixed-position overlay.
  useEffect(() => {
    document.body.style.overflow = formOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [formOpen]);


  useEffect(() => {
    setCaptionIdx(0);
    setChipIdx(-1);
    setWordIdx(-1);
    setResponseEnded(false);
    setSimShown(false);
    setPromptPaused(false);
    setPromptMuted(true);
    promptMutedRef.current = true;
    setPromptCurrentTime(0);
    setResponsePaused(true);
    setResponseCurrentTime(0);
    setCurrentScore(200);
  }, [panelIndex]);

  useEffect(() => {
    const container = promptContainerRef.current;
    if (!container) return;
    const src = DEMO_PANELS[panelIndex].questionUrl;
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.src = src;
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    video.onloadedmetadata = () => setPromptDuration(video.duration);
    video.ontimeupdate = () => setPromptCurrentTime(video.currentTime);
    video.onended = () => setPromptPaused(true);
    container.appendChild(video);
    promptVideoRef.current = video;
    video.play().catch(() => {});
    return () => { if (container.contains(video)) container.removeChild(video); };
  }, [panelIndex]);

  function set(field: keyof FormData, value: FormData[keyof FormData]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function openForm() {
    setFormOpen(true);
    setStep(1);
    setForm(EMPTY_FORM);
  }

  function buildOfferings() {
    if (form.assessmentType === 'community-schools') {
      const sections = getCsSections();
      const csSelections: Record<string, unknown> = {};
      for (const { key } of sections) {
        const mode = csMode[key] ?? 'standard';
        if (mode === 'write-own') {
          csSelections[key] = { mode };
        } else {
          const questions = ([1, 2, 3, 4] as const).map(p => {
            const qId = mode === 'custom' ? csPicks[key]?.[p] : undefined;
            const q = qId
              ? CS_QUESTIONS.find(q => q.id === qId)
              : CS_QUESTIONS.find(q => q.age === key && q.p === p && q.def);
            return q ? { pillar: p, pillarName: PILLARS[p], questionId: q.id, text: q.text } : null;
          }).filter(Boolean);
          csSelections[key] = { mode, questions };
        }
      }
      return { csSelections };
    }

    if (form.assessmentType === 'behavioral-health') {
      const screeners = getBHScreeners();
      return {
        bhSelections: {
          assessments: screeners
            .filter(s => form.bhSelectedAssessments.includes(s.id))
            .map(s => ({ id: s.id, name: s.name, grades: s.grades })),
          wantsCustom: form.bhWantsCustom,
        },
      };
    }

    if (form.assessmentType === 'learner-portrait') {
      const assessments = getLPAssessments();
      const lpSelections: Record<string, unknown> = {};
      for (const a of assessments) {
        const mode = lpMode[a.id] ?? 'standard';
        if (mode === 'write-own') {
          lpSelections[a.id] = { mode, assessmentName: a.name };
        } else if (a.id === 'lp-littles') {
          const picks = mode === 'custom' ? (lpPicks[a.id] ?? []) : [];
          const qs = mode === 'custom'
            ? picks.map(qId => { const q = LP_QUESTIONS.find(q => q.id === qId); return q ? { attribute: q.attribute, questionId: qId, text: q.prompt } : null; }).filter(Boolean)
            : LP_QUESTIONS.filter(q => q.band === a.id && q.def).map(q => ({ attribute: q.attribute, questionId: q.id, text: q.prompt }));
          lpSelections[a.id] = { mode, assessmentName: a.name, questions: qs };
        } else {
          const attrPicks = mode === 'custom' ? (lpAttrPicks[a.id] ?? []) : [];
          const qPicks   = mode === 'custom' ? (lpQPicks[a.id] ?? [])   : [];
          const attributes = attrPicks.map(attrId => LP_ATTRIBUTES.find(la => la.id === attrId)?.name ?? attrId);
          const questions = mode === 'custom'
            ? qPicks.map(qId => {
                const q = LP_QUESTIONS.find(q => q.id === qId);
                if (!q) return null;
                const attrName = attrPicks.map(aid => LP_ATTRIBUTES.find(la => la.id === aid)).find(la => la?.questionIds.includes(qId))?.name ?? q.attribute;
                return { attribute: attrName, questionId: qId, text: q.prompt };
              }).filter(Boolean)
            : LP_QUESTIONS.filter(q => q.band === a.id && q.def).map(q => ({ attribute: q.attribute, questionId: q.id, text: q.prompt }));
          lpSelections[a.id] = { mode, assessmentName: a.name, attributes, questions };
        }
      }
      return { lpSelections };
    }

    return {};
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...buildOfferings() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      setStep(7);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Assessment type helpers
  const isCS = form.assessmentType === 'community-schools';
  const isBH = form.assessmentType === 'behavioral-health';
  const isLP = form.assessmentType === 'learner-portrait';

  const studentsSelected = form.respondents.includes('Students');
  const canAdvanceStep1 = !!form.assessmentType
    && (isCS ? form.respondents.length > 0 : form.gradeLevels.length > 0)
    && (!studentsSelected || form.gradeLevels.length > 0);
  const canAdvanceStep3 = form.languages.length > 0
    && (!form.languages.includes('Other') || !!form.otherLanguage)
    && form.modalities.length > 0;
  const canAdvanceStep4 = !!form.launchTimeline && !!form.expectedCount;
  const canAdvanceContact = !!form.name && !!form.email && !!form.organization;

  function getCsSections(): Array<{ key: AgeGroup; label: string }> {
    const out: Array<{ key: AgeGroup; label: string }> = [];
    const bands = getGradeBands(form.gradeLevels);
    if (bands.has('Lower Elementary (TK–2)') || bands.has('Elementary (3rd–5th)'))
      out.push({ key: 'Elementary School', label: 'Elementary School' });
    if (bands.has('Middle School (6th–8th)'))  out.push({ key: 'Middle School',   label: 'Middle School' });
    if (bands.has('High School (9th–12th)'))   out.push({ key: 'High School',     label: 'High School' });
    if (form.respondents.includes('Families / Parents')) out.push({ key: 'Parent', label: 'Parent / Family' });
    if (form.respondents.includes('Staff'))              out.push({ key: 'Staff',  label: 'Staff' });
    return out;
  }

  function canAdvanceCS(): boolean {
    return getCsSections().every(({ key }) => {
      const mode = csMode[key] ?? 'standard';
      if (mode !== 'custom') return true;
      return ([1,2,3,4] as const).every(p => !!csPicks[key]?.[p]);
    });
  }

  function getBHScreeners(): BHScreener[] {
    const bands = getGradeBands(form.gradeLevels);
    return BH_SCREENERS.filter(s => s.gradeBands.some(gb => bands.has(gb)));
  }

  function canAdvanceBH(): boolean {
    return form.bhSelectedAssessments.length > 0 || form.bhWantsCustom;
  }

  function getLPAssessments(): LPAssessment[] {
    const bands = getGradeBands(form.gradeLevels);
    return LP_ASSESSMENTS.filter(a => a.gradeBands.some(gb => bands.has(gb)));
  }

  function canAdvanceLP(): boolean {
    const assessments = getLPAssessments();
    return assessments.every(a => {
      const mode = lpMode[a.id] ?? 'standard';
      if (mode === 'standard' || mode === 'write-own') return true;
      if (a.id === 'lp-littles') {
        const picks = lpPicks[a.id] ?? [];
        return picks.length >= 1 && picks.length <= 3;
      }
      const attrPicks = lpAttrPicks[a.id] ?? [];
      const qPicks = lpQPicks[a.id] ?? [];
      return attrPicks.length >= 1 && qPicks.length >= 1;
    });
  }

  // ── Tooltip reasons for each Continue button ────────────────────────────
  function step1Reason(): string | null {
    if (!form.assessmentType) return 'Choose an assessment type to continue.';
    if (isCS && form.respondents.length === 0) return 'Select at least one respondent group.';
    if (!isCS && form.gradeLevels.length === 0) return 'Select at least one grade level.';
    if (studentsSelected && form.gradeLevels.length === 0) return 'Select grade levels for your student respondents.';
    return null;
  }
  function step3Reason(): string | null {
    if (form.languages.length === 0) return 'Select at least one language.';
    if (form.languages.includes('Other') && !form.otherLanguage) return 'Specify the other language you need.';
    if (form.modalities.length === 0) return 'Select at least one response modality (video, audio, or text).';
    return null;
  }
  function step4Reason(): string | null {
    if (!form.launchTimeline) return 'Choose a target launch window.';
    if (!form.expectedCount) return 'Enter your expected number of respondents.';
    return null;
  }
  function csReason(): string | null {
    for (const { key, label } of getCsSections()) {
      if ((csMode[key] ?? 'standard') !== 'custom') continue;
      const missing = ([1,2,3,4] as const).filter(p => !csPicks[key]?.[p]).length;
      if (missing > 0) return `${label}: select a question for ${missing === 4 ? 'each' : `${missing} more`} pillar${missing === 1 ? '' : 's'}.`;
    }
    return null;
  }
  function bhReason(): string | null {
    if (!form.bhSelectedAssessments.length && !form.bhWantsCustom)
      return 'Select at least one screener to continue.';
    return null;
  }
  function lpReason(): string | null {
    for (const a of getLPAssessments()) {
      const mode = lpMode[a.id] ?? 'standard';
      if (mode === 'standard' || mode === 'write-own') continue;
      if (a.id === 'lp-littles') {
        const picks = lpPicks[a.id] ?? [];
        if (picks.length < 1) return `${a.name}: select at least one question.`;
        if (picks.length > 3) return `${a.name}: select no more than 3 questions.`;
      } else {
        if (!(lpAttrPicks[a.id] ?? []).length) return `${a.name}: select at least one attribute.`;
        if (!(lpQPicks[a.id] ?? []).length) return `${a.name}: select at least one question.`;
      }
    }
    return null;
  }

  // Step navigation — linear 1→2→3→4→5→7
  type S = 1|2|3|4|5|6|7;
  function nextStep(cur: number): S {
    if (cur === 5) return 7;
    return (cur + 1) as S;
  }
  function prevStep(cur: number): S {
    return (cur - 1) as S;
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: 'white' }}>

      {/* ── Floating CTA tab ─────────────────────────────────────────────────── */}
      {!formOpen && (
        <button
          onClick={() => window.open('/pilot?start=1', '_blank')}
          aria-label="Start Today"
          style={{
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 25,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            rotate: '180deg',
            background: 'linear-gradient(180deg, #e07b54 0%, #cc6648 35%, #9a4a80 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '28px 16px',
            borderRadius: '10px 0 0 10px',
            boxShadow: '-4px 0 24px rgba(224,123,84,0.55), -2px 0 8px rgba(0,0,0,0.15)',
            border: 'none',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.paddingRight = '20px'; e.currentTarget.style.opacity = '0.92'; }}
          onMouseLeave={e => { e.currentTarget.style.paddingRight = '16px'; e.currentTarget.style.opacity = '1'; }}
        >
          Start Today
        </button>
      )}

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="px-6 py-0 flex items-center justify-between" style={{ background: '#1a2744', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="https://impacterpathway.com" target="_blank" rel="noopener noreferrer">
            <img src="/Logo_Transparent_Background.png" alt="Impacter Pathway" style={{ height: 72 }} />
          </a>
          <span className="hidden sm:inline-block text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em' }}>Pilot Program</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setDemoOpen(true)}
            style={{ background: 'linear-gradient(135deg, #2e5fa3 0%, #6a5ab0 50%, #cc6648 100%)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em', whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Request a Demo
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2e5fa3 0%, #3a62aa 18%, #4a6ab8 36%, #6a5ab0 54%, #9a4a80 68%, #cc6648 84%, #bf5c3c 100%)', minHeight: '42vh', display: 'flex', alignItems: 'center' }}>
        {/* Soft radial overlay for depth */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 60%, rgba(255,255,255,0.07) 0%, transparent 55%)', pointerEvents: 'none' }} />
        {/* SVG circular watermark */}
        <svg style={{ position: 'absolute', right: '5%', top: '10%', width: 340, height: 340, opacity: 0.07, pointerEvents: 'none' }} viewBox="0 0 340 340">
          {[0,1,2,3].map(i => <circle key={i} cx="170" cy="170" r={60 + i * 40} fill="none" stroke="white" strokeWidth="1" />)}
          {Array.from({length: 16}).map((_,i) => {
            const a = (i/16)*Math.PI*2; const r = 170;
            return <line key={i} x1="170" y1="170" x2={170+Math.cos(a)*r} y2={170+Math.sin(a)*r} stroke="white" strokeWidth="0.5" />;
          })}
        </svg>
        <div className="max-w-3xl mx-auto px-6 py-12 text-center relative w-full">
          <h1 className="font-bold leading-tight mb-6 text-white" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}>
            Hear from students.<br />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>Turn their voice into action.</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.75)' }}>
            An Impacter Pathway pilot captures voice-based responses and evaluates them against rubric-defined competency levels at scale, producing clear, decision-grade insight into student experience and demonstration of future-ready skills.
          </p>
          {/* CTA + chips */}
          <div className="flex flex-col items-center gap-8">
            {/* Frosted stat chips */}
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {['No app download', 'Results in days', 'Multilingual', 'COPPA & FERPA compliant'].map(label => (
                <div key={label} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#e07b54' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  {label}
                </div>
              ))}
            </div>
            <button
              onClick={() => setDemoOpen(true)}
              style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(14px)', border: '1.5px solid rgba(255,255,255,0.38)', color: 'white', borderRadius: 50, padding: '13px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
            >
              Request a Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-14 relative" style={{ background: 'linear-gradient(180deg, #f8fafd 0%, #f0f5fb 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-semibold uppercase tracking-widest mb-10" style={{ color: '#4a6fa5', fontSize: '1.1rem' }}>How it works</h2>
          <div className="flex items-start justify-center">
            {[
              { n: '1', color: '#e07b54', title: 'Create an engaging, voice-based assessment' },
              { n: '2', color: '#2d7a5f', title: 'Send students a link to capture their authentic perspective' },
              { n: '3', color: '#4a6fa5', title: 'Receive insights & personalized recommendations' },
            ].map(({ n, color, title }, i) => (
              <>
                <div key={n} className="flex flex-col items-center" style={{ width: 160 }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white mb-4" style={{ background: color }}>
                    {n}
                  </div>
                  <p className="text-sm font-semibold text-gray-700 leading-snug text-center">{title}</p>
                </div>
                {i < 2 && (
                  <div key={`arrow-${i}`} className="flex items-start pt-5 shrink-0">
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none" style={{ color: '#c5d5e8' }}>
                      <path d="M2 12h24M20 5l8 7-8 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action ─────────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: '#f4f7fc' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-8 text-center">
            <h2 className="font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5', fontSize: '1.1rem' }}>See it in action</h2>
            <p className="text-base font-semibold text-gray-900">Real assessments from Impacter Pathway partners</p>
          </div>

          {/* Fake player shell */}
          <div style={{ background: '#03568C', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(3,86,140,0.3)' }}>

            {/* Top bar */}
            <div style={{ background: 'rgba(0,0,0,0.18)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>{panel.assessmentName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{panel.school}</span>
              </div>
            </div>

            {/* Two-panel body */}
            <div style={{ display: 'flex', height: 420 }}>

              {/* ── Left: question video ── */}
              <div
                style={{ flex: '0 0 50%', position: 'relative', background: '#012d4a', overflow: 'hidden', cursor: 'pointer' }}
                onMouseEnter={() => setPromptHovered(true)}
                onMouseLeave={() => setPromptHovered(false)}
                onClick={() => {
                  const v = promptVideoRef.current;
                  if (!v) return;
                  if (promptMutedRef.current) { v.currentTime = 0; v.muted = false; v.volume = 1; promptMutedRef.current = false; setPromptMuted(false); v.play(); setPromptPaused(false); }
                  else if (v.paused) { v.play(); setPromptPaused(false); }
                  else { v.pause(); setPromptPaused(true); }
                }}
              >
                <div ref={promptContainerRef} style={{ width: '100%', height: '100%' }} />
                {/* Question text overlaid on video */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: '16px 22px 0', pointerEvents: 'none', zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }}>
                  <p style={{ color: 'white', fontSize: 22, fontWeight: 800, lineHeight: 1.35, margin: 0, textShadow: '0 2px 16px rgba(0,0,0,0.6)', fontFamily: "'Apercu Pro', 'Apercu', 'DM Sans', sans-serif" }}>
                    {panel.promptText}
                  </p>
                </div>
                {promptMuted && (
                  <div style={{ position: 'absolute', bottom: 36, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
                    <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: 'white', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '4px 12px', letterSpacing: '0.03em' }}>Tap for sound</span>
                  </div>
                )}
                {/* Play/pause indicator */}
                {(!promptMuted && (promptPaused || promptHovered)) && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', zIndex: 3, pointerEvents: 'none' }}>
                    {promptPaused
                      ? <svg width="24" height="24" viewBox="0 0 24 24" fill="#03568C"><path d="M8 5v14l11-7z"/></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="#03568C"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    }
                  </div>
                )}
                {/* Thin progress bar at bottom */}
                <div
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.18)', zIndex: 5, cursor: 'pointer' }}
                  onClick={e => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    const v = promptVideoRef.current;
                    if (v && promptDuration) v.currentTime = pct * promptDuration;
                  }}
                >
                  <div style={{ height: '100%', background: 'white', width: `${promptDuration ? (promptCurrentTime / promptDuration) * 100 : 0}%`, transition: 'width 0.1s linear' }} />
                </div>
              </div>

              {/* ── Right: response panel ── */}
              <div style={{ flex: '1', background: '#03568C', padding: '36px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0, position: 'relative', overflow: 'hidden' }}>
                {!simShown ? (
                  <>
                    <p style={{ color: 'white', fontSize: 15, fontWeight: 600, margin: '0 0 20px', textAlign: 'center' }}>
                      How would you like to answer?
                    </p>

                    {/* Response mode buttons */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      {([
                        { label: 'VIDEO', icon: (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                            <rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/>
                          </svg>
                        )},
                        { label: 'AUDIO', icon: (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                            <rect x="9" y="2" width="6" height="11" rx="3"/>
                            <path d="M19 10a7 7 0 0 1-14 0" fill="none" stroke="white" strokeWidth="2.2"/>
                            <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="2.2"/>
                          </svg>
                        )},
                        { label: 'TEXT', icon: (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M8 9h8M12 9v6" fill="none" stroke="#598DAD" strokeWidth="2.2" strokeLinecap="round"/>
                          </svg>
                        )},
                      ] as const).map(({ label, icon }) => (
                        <button key={label} style={{ flex: 1, background: '#598DAD', borderRadius: 10, padding: '14px 8px 10px', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          {icon}
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Practice text */}
                    <p style={{ color: '#FFB547', fontSize: 12, margin: '0 0 24px', textAlign: 'center' }}>🔥 You can practice before sending</p>

                    {/* Simulate button */}
                    <button
                      onClick={() => { setSimShown(true); setResponsePaused(true); }}
                      style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '0.01em', boxShadow: '0 4px 20px rgba(34,197,94,0.35)', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      Simulate a {panel.respondentLabel} Response
                    </button>
                  </>
                ) : (
                  /* ── Student response panel — fills full right panel ── */
                  <div style={{ position: 'absolute', inset: 0, background: '#024870', display: 'flex', flexDirection: 'column' }}>
                    {/* Label bar */}
                    <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                        {panel.respondentLabel} Response
                      </p>
                      <button
                        onClick={() => setSimShown(false)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                      >
                        ← Back
                      </button>
                    </div>
                    {/* Video fills remaining space */}
                    <div
                      style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                      onMouseEnter={() => setResponseHovered(true)}
                      onMouseLeave={() => setResponseHovered(false)}
                      onClick={() => {
                        const v = responseVideoRef.current;
                        if (!v) return;
                        if (v.paused) { v.play(); setResponsePaused(false); }
                        else { v.pause(); setResponsePaused(true); }
                      }}
                    >
                      <style>{`@keyframes captionIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes chipIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}@keyframes wordPop{0%{opacity:0;transform:scale(0.65)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}@keyframes endIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}`}</style>
                      <video
                        key={panel.responseUrl}
                        ref={responseVideoRef}
                        src={panel.responseUrl}
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onLoadedMetadata={() => setResponseDuration(responseVideoRef.current?.duration ?? 0)}
                        onEnded={() => { setResponsePaused(true); setResponseEnded(true); }}
                        onTimeUpdate={() => {
                          const t = responseVideoRef.current?.currentTime ?? 0;
                          setResponseCurrentTime(t);
                          setCurrentScore(interpolateScore(panel.scoreTimeline, t));
                          if (panel.captions.length) {
                            const idx = panel.captions.reduce((acc, c, i) => (c.t <= t ? i : acc), 0);
                            setCaptionIdx(idx);
                          }
                          if (panel.chips.length) {
                            const cIdx = panel.chips.reduce((acc: number, c, i) => (c.t <= t ? i : acc), -1);
                            if (cIdx !== chipIdx) setChipIdx(cIdx);
                          }
                          if (panel.words.length) {
                            const wIdx = panel.words.reduce((acc: number, w, i) => (w.t <= t ? i : acc), -1);
                            if (wIdx !== wordIdx) setWordIdx(wIdx);
                          }
                        }}
                      />
                      {/* Play/pause indicator */}
                      {(responsePaused || responseHovered) && !responseEnded && (
                        <div style={{ position: 'absolute', top: '50%', left: '40%', transform: 'translate(-50%,-50%)', width: 54, height: 54, borderRadius: '50%', background: responsePaused ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', zIndex: 3, pointerEvents: 'none' }}>
                          {responsePaused
                            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="#1a2744"><path d="M8 5v14l11-7z"/></svg>
                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                          }
                        </div>
                      )}
                      {/* Insight chips — top-right */}
                      {chipIdx >= 0 && chipIdx < panel.chips.length && (
                        <div
                          key={`chip-${chipIdx}`}
                          style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, animation: 'chipIn 0.3s ease both' }}
                        >
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'rgba(0,0,0,0.78)',
                            border: `1.5px solid ${panel.chips[chipIdx].color}`,
                            backdropFilter: 'blur(8px)',
                            color: panel.chips[chipIdx].color,
                            borderRadius: 20, padding: '5px 11px',
                            fontSize: 11, fontWeight: 700,
                            letterSpacing: '0.05em', textTransform: 'uppercase',
                            boxShadow: `0 2px 12px rgba(0,0,0,0.5), 0 0 10px ${panel.chips[chipIdx].color}40`,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: panel.chips[chipIdx].color, flexShrink: 0 }} />
                            {panel.chips[chipIdx].text}
                          </span>
                        </div>
                      )}
                      {/* Score dial — middle right */}
                      {!responseEnded && (
                        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pointerEvents: 'none' }}>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>SCORE</span>
                          <ScoreDial score={currentScore} />
                        </div>
                      )}
                      {/* Green word captions */}
                      {!responseEnded && panel.words.length > 0 && captionIdx >= 0 && (() => {
                        const captionStart = panel.captions[captionIdx]?.t ?? 0;
                        const captionEnd = captionIdx + 1 < panel.captions.length ? panel.captions[captionIdx + 1].t : Infinity;
                        const captionWords = panel.words
                          .map((w, origIdx) => ({ ...w, origIdx }))
                          .filter(w => w.t >= captionStart && w.t < captionEnd);
                        if (!captionWords.length) return null;
                        return (
                          <div key={captionIdx} style={{ position: 'absolute', bottom: 22, left: 0, right: 0, pointerEvents: 'none', padding: '0 16px', overflow: 'hidden', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, textShadow: '0 1px 10px rgba(0,0,0,0.95)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              {captionWords.map((w, i) => {
                                const isCurrent = w.origIdx === wordIdx;
                                const isSpoken = w.t <= responseCurrentTime;
                                return (
                                  <span key={i} style={{
                                    color: isCurrent ? '#4ade80' : isSpoken ? '#86efac' : 'rgba(255,255,255,0.28)',
                                    fontWeight: isCurrent ? 700 : isSpoken ? 500 : 400,
                                    marginRight: '0.28em',
                                    transition: 'color 0.12s',
                                    display: 'inline',
                                  }}>
                                    {w.word}
                                  </span>
                                );
                              })}
                            </p>
                          </div>
                        );
                      })()}
                      {/* Caption pill — shown only if no word data */}
                      {!responseEnded && panel.words.length === 0 && panel.captions.length > 0 && (
                        <div key={captionIdx} style={{ position: 'absolute', bottom: 22, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 20px', animation: 'captionIn 0.25s ease both' }}>
                          <span style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '5px 12px', fontSize: 13, fontWeight: panel.captions[captionIdx]?.accent ? 700 : 500, color: panel.captions[captionIdx]?.accent ? '#86efac' : 'rgba(255,255,255,0.92)', lineHeight: 1.5, textAlign: 'center' }}>
                            {panel.captions[captionIdx]?.text}
                          </span>
                        </div>
                      )}
                      {/* Response scrubber */}
                      {!responseEnded && (
                        <div
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, zIndex: 5, cursor: 'pointer' }}
                          onClick={e => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pct = (e.clientX - rect.left) / rect.width;
                            const v = responseVideoRef.current;
                            if (v && responseDuration) v.currentTime = pct * responseDuration;
                          }}
                        >
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.15)' }}>
                            <div style={{ height: '100%', background: 'rgba(255,255,255,0.65)', width: `${responseDuration ? (responseCurrentTime / responseDuration) * 100 : 0}%`, transition: 'width 0.1s linear' }} />
                          </div>
                        </div>
                      )}
                      {/* ── End screen ── */}
                      {responseEnded && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,17,30,0.94)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', zIndex: 10, padding: '18px 20px 14px', gap: 12, animation: 'endIn 0.4s ease both' }}>
                          {/* Score + Chips row */}
                          <div style={{ flex: 1, display: 'flex', gap: 14, alignItems: 'center', minHeight: 0 }}>
                            {/* Dial */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Final Score</p>
                              <ScoreDial score={currentScore} size="lg" />
                            </div>
                            {/* Chips */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignContent: 'center', flex: 1 }}>
                              {panel.chips.map((chip, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.45)', border: `1.5px solid ${chip.color}`, color: chip.color, borderRadius: 12, padding: '3px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: chip.color, flexShrink: 0 }} />
                                  {chip.text}
                                </span>
                              ))}
                            </div>
                          </div>
                          {/* Buttons */}
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexShrink: 0 }}>
                            <button
                              onClick={() => { setResponseEnded(false); setResponsePaused(false); setWordIdx(-1); setCaptionIdx(0); setCurrentScore(panel.scoreTimeline[0].score); const v = responseVideoRef.current; if (v) { v.currentTime = 0; v.play(); } }}
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em' }}>
                              ↺ Replay
                            </button>
                            <button
                              onClick={() => setPanelIndex(i => (i + 1) % DEMO_PANELS.length)}
                              style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.01em' }}>
                              Next Question
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6"/></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Panel navigation tabs ── */}
            <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.18)', background: 'rgba(0,0,0,0.15)' }}>
              {DEMO_PANELS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPanelIndex(i)}
                  style={{ flex: 1, padding: '11px 10px 10px', background: i === panelIndex ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', borderTop: `2px solid ${i === panelIndex ? 'rgba(255,255,255,0.5)' : 'transparent'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (i !== panelIndex) e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { if (i !== panelIndex) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ color: i === panelIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: 700, letterSpacing: '0.01em', transition: 'color 0.15s' }}>{p.assessmentName}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: '0.01em' }}>{p.school}</span>
                </button>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Sample Report Insights (2×2 interactive grid) ───────────────────── */}
      <section className="border-b border-gray-100 py-14" style={{ background: '#f4f7fc' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5', fontSize: '1.1rem' }}>Sample report insights</p>
              <h2 className="text-xl font-bold text-gray-900">What you can&apos;t get from a survey.</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-2 font-semibold px-4 py-2 rounded-lg transition-opacity"
                style={{ color: 'white', background: '#e07b54', fontSize: 13, boxShadow: '0 2px 10px rgba(224,123,84,0.3)', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                View Sample Report
              </button>
              <button
                onClick={() => setCsvOpen(true)}
                className="inline-flex items-center gap-2 font-semibold px-4 py-2 rounded-lg transition-opacity"
                style={{ color: 'white', background: '#2d7a5f', fontSize: 13, boxShadow: '0 2px 10px rgba(45,122,95,0.35)', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                View Sample CSV
              </button>
            </div>
          </div>

          {/* 2×2 interactive grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>

            {/* ── Card 1: BH Gender Gap ── */}
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '24px 22px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#4a6fa5', marginBottom: 4 }}>Behavioral Health · Domain Analysis</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>Scores by domain, female vs. male respondents</p>
              <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 11, color: '#6b7280' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 9, borderRadius: 2, display: 'inline-block', background: '#4a6fa5' }} />Female</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 9, borderRadius: 2, display: 'inline-block', background: '#d1dff0' }} />Male</span>
              </div>
              <svg viewBox="0 0 440 210" style={{ width: '100%', overflow: 'visible' }}>
                {BH_DOMAIN_DATA.map((d, i) => {
                  const yCenter = 22 + i * 40;
                  const maxW = 250;
                  const scaleW = (v: number) => (v / 800) * maxW;
                  const gap = d.female - d.male;
                  const maxGap = Math.max(...BH_DOMAIN_DATA.map(x => x.female - x.male));
                  const isHov = bhHover === i;
                  const gapX1 = 160 + scaleW(d.male);
                  const gapX2 = 160 + scaleW(d.female);
                  const gapMid = (gapX1 + gapX2) / 2;
                  return (
                    <g key={d.domain} onMouseEnter={() => setBhHover(i)} onMouseLeave={() => setBhHover(null)} style={{ cursor: 'pointer' }}>
                      {isHov && <rect x="0" y={yCenter - 19} width="440" height="38" rx="6" fill="#f0f5ff" />}
                      <text x="156" y={yCenter + 3} textAnchor="end" fontSize="11" fill={isHov ? '#1a2a44' : '#6b7280'} fontWeight={isHov ? '600' : '400'}>{d.domain}</text>
                      <rect x="160" y={yCenter - 14} width={scaleW(d.male)} height={28} rx="4" fill={isHov ? '#c8d9f0' : '#e0eaf8'} />
                      <rect x="160" y={yCenter - 14} width={scaleW(d.female)} height={13} rx="3" fill={isHov ? '#2d5fa5' : '#4a6fa5'} />
                      <text x={164 + scaleW(d.female)} y={yCenter - 3} fontSize="10" fill="#4a6fa5" fontWeight="700">{d.female}</text>
                      <text x={164 + scaleW(d.male)} y={yCenter + 12} fontSize="10" fill="#9ab4d0" fontWeight="600">{d.male}</text>
                      {gap === maxGap && (
                        <g>
                          <rect x="2" y={yCenter - 17} width="436" height="34" rx="5" fill="rgba(251,191,36,0.06)" stroke="#fbbf24" strokeWidth="1.5" />
                          <text x="8" y={yCenter - 21} fontSize="8" fill="#f59e0b" fontWeight="700" letterSpacing="0.04em">WIDEST GAP</text>
                          <line x1={gapX1} y1={yCenter - 13} x2={gapX2} y2={yCenter - 13} stroke="rgba(251,191,36,0.9)" strokeWidth="1.5" />
                          <line x1={gapX1} y1={yCenter - 14} x2={gapX1} y2={yCenter - 9} stroke="rgba(251,191,36,0.9)" strokeWidth="1.5" />
                          <line x1={gapX2} y1={yCenter - 14} x2={gapX2} y2={yCenter - 9} stroke="rgba(251,191,36,0.9)" strokeWidth="1.5" />
                          <text x={gapMid} y={yCenter - 3} textAnchor="middle" fontSize="8.5" fill="#fbbf24" fontWeight="800">+{gap} pts</text>
                        </g>
                      )}
                      {isHov && (
                        <g transform={`translate(160, ${Math.max(-30, yCenter - 70)})`}>
                          <rect x="0" y="0" width="240" height="56" rx="7" fill="#1a2a44" />
                          <polygon points="100,56 110,64 120,56" fill="#1a2a44" />
                          <text x="120" y="15" textAnchor="middle" fontSize="10" fill="#93c5fd" fontWeight="700">{d.domain}</text>
                          <line x1="10" y1="21" x2="230" y2="21" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                          <text x="120" y="34" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">Gap: +{gap} pts</text>
                          <text x="120" y="49" textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.65)">e.g. {d.ling.marker}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
                <line x1="160" y1="0" x2="160" y2="205" stroke="#e5e7eb" strokeWidth="1" />
              </svg>
              <div style={{ background: '#eef4ff', borderRadius: 8, padding: '9px 13px', marginTop: 12, borderLeft: '3px solid #4a6fa5' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a6fa5', margin: '0 0 3px 0' }}>Insight</p>
                <p style={{ fontSize: 12.5, fontStyle: 'italic', color: '#3a5a9a', margin: 0, lineHeight: 1.5 }}>Girls outscore boys in all five domains; the gap is widest in Relational Awareness (122 pts) and narrowest in Emotional Resilience (57 pts).</p>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 13px', marginTop: 8, borderLeft: '3px solid #2d7a5f' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d7a5f', margin: '0 0 3px 0' }}>Recommendation</p>
                <p style={{ fontSize: 12.5, color: '#1a5f44', margin: 0, lineHeight: 1.55 }}>Host a <strong>Male Mentorship Speaker Series</strong> where male students hear from coaches, counselors, and community figures who model relational language, emotional naming, and conflict navigation openly.</p>
              </div>
            </div>


            {/* ── Card 2: Risk Language Heatmap ── */}
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '24px 22px', position: 'relative' }}>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#4a6fa5', marginBottom: 4 }}>Behavioral Health · Risk Signals</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>Risk language frequency by pattern and grade, % of spoken words</p>
              <div style={{ position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 7px', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: 10, paddingRight: 16, fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Pattern</th>
                      {['6th', '7th', '8th'].map(g => (
                        <th key={g} style={{ textAlign: 'center', paddingBottom: 10, paddingLeft: 8, paddingRight: 8, fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>{g}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_ROWS.map((row, r) => {
                      const vals = [row.g6, row.g7, row.g8];
                      const isRowHov = hmHover?.r === r && hmHover?.c === -1;
                      const isSelfDoubt = r === 3;
                      const yellowBorder = '2px solid #fbbf24';
                      return (
                        <tr key={r} style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHmHover({ r, c: -1 })}
                          onMouseLeave={() => setHmHover(null)}
                        >
                          <td style={{ paddingTop: 9, paddingBottom: 9, paddingRight: 16, paddingLeft: isSelfDoubt ? 10 : 0, fontWeight: isSelfDoubt ? 700 : 500, color: isRowHov ? '#1a2a44' : isSelfDoubt ? '#92400e' : '#374151', fontSize: 12, borderTop: isSelfDoubt ? yellowBorder : undefined, borderBottom: isSelfDoubt ? yellowBorder : undefined, borderLeft: isSelfDoubt ? yellowBorder : undefined, borderRadius: isSelfDoubt ? '5px 0 0 5px' : undefined }}>
                            {row.pattern}
                            {isSelfDoubt && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.04em', verticalAlign: 'middle' }}>↑ PEAK</span>}
                          </td>
                          {vals.map((v, c) => {
                            const intensity = v / 7.25;
                            const bg = `rgba(74,111,165,${0.1 + intensity * 0.72})`;
                            const textCol = intensity > 0.5 ? '#1e3a5f' : '#6b7280';
                            const isLast = c === vals.length - 1;
                            return (
                              <td key={c} style={{ paddingTop: 9, paddingBottom: 9, paddingLeft: 8, paddingRight: 8, textAlign: 'center', fontWeight: 700, fontSize: 13, background: isSelfDoubt && c === 2 ? `rgba(251,191,36,0.18)` : bg, color: isSelfDoubt && c === 2 ? '#92400e' : textCol, borderRadius: 5, borderTop: isSelfDoubt ? yellowBorder : undefined, borderBottom: isSelfDoubt ? yellowBorder : undefined, borderRight: isSelfDoubt && isLast ? yellowBorder : undefined }}>
                                {v.toFixed(2)}%
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {hmHover && hmHover.c === -1 && (() => {
                  const row = RISK_ROWS[hmHover.r];
                  const tipTop = -35 + hmHover.r * 39;
                  return (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: tipTop, background: '#1a2a44', color: 'white', borderRadius: 8, padding: '9px 14px', fontSize: 11, zIndex: 10, pointerEvents: 'none' }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, color: '#93c5fd' }}>{row.pattern}</div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 3 }}>e.g. {row.ling}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Grade rank: {row.gradeRank}</div>
                      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1a2a44' }} />
                    </div>
                  );
                })()}
              </div>
              <div style={{ background: '#eef4ff', borderRadius: 8, padding: '9px 13px', marginTop: 14, borderLeft: '3px solid #4a6fa5' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a6fa5', margin: '0 0 3px 0' }}>Insight</p>
                <p style={{ fontSize: 12.5, fontStyle: 'italic', color: '#3a5a9a', margin: 0, lineHeight: 1.5 }}>Self-doubt language peaks in 8th grade at 7.12%, nearly double the 6th grade rate. This is the steepest grade-level climb of any risk pattern.</p>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 13px', marginTop: 8, borderLeft: '3px solid #2d7a5f' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d7a5f', margin: '0 0 3px 0' }}>Recommendation</p>
                <p style={{ fontSize: 12.5, color: '#1a5f44', margin: 0, lineHeight: 1.55 }}>Build an <strong>8th Grade Transition Intensive</strong>: a school counselor-led workshop series for 8th graders focused on identity, confidence, and high school readiness, addressing the self-doubt spike directly before the transition.</p>
              </div>
            </div>

            {/* ── Card 3: CS Pillars ── */}
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '24px 22px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#4a6fa5', marginBottom: 4 }}>Community Schools · Pillar Scores</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>District average score by pillar (0–1 scale)</p>
              <svg viewBox="0 0 440 210" style={{ width: '100%', overflow: 'visible' }}>
                {PARTHENON_PILLARS.map((p, i) => {
                  const pillarW = 84; const gapW = 16;
                  const startX = (440 - (4 * pillarW + 3 * gapW)) / 2;
                  const x = startX + i * (pillarW + gapW);
                  const maxH = 148; const h = (p.height / 100) * maxH; const y = 162 - h;
                  const isHov = csHover === i;
                  return (
                    <g key={p.label} onMouseEnter={() => setCsHover(i)} onMouseLeave={() => setCsHover(null)} style={{ cursor: 'pointer' }}>
                      <rect x={x} y={y} width={pillarW} height={h} rx="5" fill={p.color} fillOpacity={isHov ? 1 : 0.72} style={{ transition: 'fill-opacity 0.15s' }} />
                      <text x={x + pillarW / 2} y={y + h / 2 - 5} textAnchor="middle" fontSize="19" fontWeight="800" fill="white">{p.score}</text>
                      <text x={x + pillarW / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.6)">avg</text>
                      <rect x={x - 5} y={y - 8} width={pillarW + 10} height={8} rx="2" fill={p.color} fillOpacity={isHov ? 1 : 0.88} />
                      <text x={x + pillarW / 2} y="178" textAnchor="middle" fontSize="9" fill={isHov ? '#1a2a44' : '#6b7280'} fontWeight={isHov ? '600' : '400'}>{p.label.split(' ').slice(0, 2).join(' ')}</text>
                      <text x={x + pillarW / 2} y="191" textAnchor="middle" fontSize="9" fill={isHov ? '#1a2a44' : '#6b7280'} fontWeight={isHov ? '600' : '400'}>{p.label.split(' ').slice(2).join(' ')}</text>
                    </g>
                  );
                })}
                <rect x="10" y="162" width="420" height="4" rx="2" fill="#e5e7eb" />
                {csHover !== null && (() => {
                  const p = PARTHENON_PILLARS[csHover];
                  const pillarW = 84; const gapW = 16;
                  const startX = (440 - (4 * pillarW + 3 * gapW)) / 2;
                  const x = startX + csHover * (pillarW + gapW);
                  const h = (p.height / 100) * 148; const y = 162 - h;
                  const tipW = 200; const tipH = 64;
                  const rawX = x + pillarW / 2 - tipW / 2;
                  const tipX = Math.max(4, Math.min(440 - tipW - 4, rawX));
                  const tipY = y - tipH - 10;
                  const arrowX = x + pillarW / 2 - tipX;
                  const leader = p.schools.find(s => s.leads)!;
                  const trailer = [...p.schools].sort((a, b) => a.score - b.score)[0];
                  return (
                    <g transform={`translate(${tipX}, ${tipY})`} style={{ pointerEvents: 'none' }}>
                      <rect x="0" y="0" width={tipW} height={tipH} rx="8" fill="#1a2a44" />
                      <polygon points={`${arrowX - 6},${tipH} ${arrowX},${tipH + 8} ${arrowX + 6},${tipH}`} fill="#1a2a44" />
                      <text x={tipW / 2} y="14" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.4)" fontWeight="700" letterSpacing="0.08em">{p.label.toUpperCase()}</text>
                      <line x1="10" y1="20" x2={tipW - 10} y2="20" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <text x="14" y="37" fontSize="11" fill="#4ade80" fontWeight="700">↑ {leader.name}</text>
                      <text x={tipW - 14} y="37" textAnchor="end" fontSize="11" fill="#4ade80" fontWeight="700">{leader.score.toFixed(2)}</text>
                      <text x="14" y="55" fontSize="11" fill="#fb923c" fontWeight="700">↓ {trailer.name}</text>
                      <text x={tipW - 14} y="55" textAnchor="end" fontSize="11" fill="#fb923c" fontWeight="700">{trailer.score.toFixed(2)}</text>
                    </g>
                  );
                })()}
              </svg>
              <div style={{ background: '#eef4ff', borderRadius: 8, padding: '9px 13px', marginTop: 12, borderLeft: '3px solid #4a6fa5' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a6fa5', margin: '0 0 3px 0' }}>Insight</p>
                <p style={{ fontSize: 12.5, fontStyle: 'italic', color: '#3a5a9a', margin: 0, lineHeight: 1.5 }}>Collaborative Leadership is the weakest pillar district-wide at 0.82, trailing Integrated Student Supports by 0.13 points.</p>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 13px', marginTop: 8, borderLeft: '3px solid #2d7a5f' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d7a5f', margin: '0 0 3px 0' }}>Recommendation</p>
                <p style={{ fontSize: 12.5, color: '#1a5f44', margin: 0, lineHeight: 1.55 }}>Launch a <strong>Student-Staff Leadership Council</strong> where student representatives and staff meet monthly to co-create one campus decision per quarter, building shared ownership of school direction from the ground up.</p>
              </div>
            </div>

            {/* ── Card 4: Voice Tone Analysis ── */}
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '24px 22px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#4a6fa5', marginBottom: 4 }}>Community Schools · Voice Tone Analysis</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>Affirming vs. constructive voice tone by stakeholder group</p>
              <svg viewBox="0 0 440 210" style={{ width: '100%', overflow: 'visible' }}>
                <line x1="220" y1="0" x2="220" y2="210" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="4 3" />
                <text x="95" y="13" textAnchor="middle" fontSize="9.5" fill="#9ca3af" fontWeight="600">← CONSTRUCTIVE</text>
                <text x="340" y="13" textAnchor="middle" fontSize="9.5" fill="#9ca3af" fontWeight="600">AFFIRMING →</text>
                {VOICE_TONE.map((d, i) => {
                  const rowY = 30 + i * 60;
                  const maxHalf = 190;
                  const affW = (d.affirming / 100) * maxHalf;
                  const conW = (d.concern / 100) * maxHalf;
                  const isHov = toneHover === i;
                  return (
                    <g key={d.group} onMouseEnter={() => setToneHover(i)} onMouseLeave={() => setToneHover(null)} style={{ cursor: 'pointer' }}>
                      {isHov && <rect x="0" y={rowY - 2} width="440" height="46" rx="6" fill="#f8f9fc" />}
                      <text x="220" y={rowY + 8} textAnchor="middle" fontSize="12" fill={isHov ? '#1a2a44' : '#374151'} fontWeight="700">{d.group}</text>
                      <rect x={220 - conW} y={rowY + 14} width={conW} height={22} rx="4" fill="#e07b54" fillOpacity={isHov ? 0.88 : 0.62} />
                      {i === 2 && <rect x={220 - conW - 2} y={rowY + 12} width={conW + 4} height={26} rx="5" fill="none" stroke="#fbbf24" strokeWidth="1.5" />}
                      {i === 2 && <text x={220 - conW / 2} y={rowY + 9} textAnchor="middle" fontSize="8" fill="#f59e0b" fontWeight="700" letterSpacing="0.04em">↑ HIGHEST</text>}
                      <text x={220 - conW - 5} y={rowY + 29} textAnchor="end" fontSize="11" fill="#c0502a" fontWeight="600">{d.concern}%</text>
                      <rect x="220" y={rowY + 14} width={affW} height={22} rx="4" fill="#2d7a5f" fillOpacity={isHov ? 0.88 : 0.62} />
                      <text x={220 + affW + 5} y={rowY + 29} textAnchor="start" fontSize="11" fill="#1a5f44" fontWeight="600">{d.affirming}%</text>
                      {isHov && (
                        <g transform={`translate(${220 - 110}, ${rowY - 66})`}>
                          <rect x="0" y="0" width="220" height="56" rx="7" fill="#1a2a44" />
                          <polygon points="104,56 110,64 116,56" fill="#1a2a44" />
                          <text x="110" y="16" textAnchor="middle" fontSize="11" fill="white" fontWeight="700">{d.group}</text>
                          <line x1="10" y1="22" x2="210" y2="22" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                          <line x1="110" y1="22" x2="110" y2="52" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                          <text x="55" y="33" textAnchor="middle" fontSize="8" fill="#fb923c" fontWeight="700" letterSpacing="0.05em">TOP CONSTRUCTIVE</text>
                          <text x="55" y="47" textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.8)">{d.constructiveSignal}</text>
                          <text x="165" y="33" textAnchor="middle" fontSize="8" fill="#4ade80" fontWeight="700" letterSpacing="0.05em">TOP AFFIRMING</text>
                          <text x="165" y="47" textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.8)">{d.affirmingSignal}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div style={{ background: '#eef4ff', borderRadius: 8, padding: '9px 13px', marginTop: 8, borderLeft: '3px solid #4a6fa5' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a6fa5', margin: '0 0 3px 0' }}>Insight</p>
                <p style={{ fontSize: 12.5, fontStyle: 'italic', color: '#3a5a9a', margin: 0, lineHeight: 1.5 }}>Families lead in affirming tone (68%) while staff carry the most constructive language (44%), primarily around workload concerns.</p>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 13px', marginTop: 8, borderLeft: '3px solid #2d7a5f' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d7a5f', margin: '0 0 3px 0' }}>Recommendation</p>
                <p style={{ fontSize: 12.5, color: '#1a5f44', margin: 0, lineHeight: 1.55 }}>Conduct a <strong>Staff Workload Audit</strong> where site administrators inventory current staff responsibilities and identify tasks that can be redistributed, automated, or eliminated, reducing the burden that drives constructive tone.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Preview modal ────────────────────────────────────────────────────── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewModal(null)}>
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full" style={{ maxWidth: '92vw', height: '88vh' }} onClick={e => e.stopPropagation()}>
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

      {/* ── Sample Report modal ──────────────────────────────────────────────── */}
      {reportOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
          onClick={e => { if (e.target === e.currentTarget) setReportOpen(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,20,40,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setReportOpen(false)} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 16, width: '100%', maxWidth: 860, height: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a6fa5', margin: '0 0 2px' }}>Sample Report</p>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a2744', margin: 0 }}>Sample Behavioral Health Report</h2>
              </div>
              <button onClick={() => setReportOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>✕</button>
            </div>
            <iframe
              src="https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Sample%20BHS%20Report,%20District%20(1).pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvU2FtcGxlIEJIUyBSZXBvcnQsIERpc3RyaWN0ICgxKS5wZGYiLCJpYXQiOjE3NzY0MTk0OTksImV4cCI6MjA5MTc3OTQ5OX0.aZhEYSyyUVIEfcbSk-wwLtEqDeRqCd5MPBiwKygQ71U#navpanes=0&toolbar=0"
              style={{ flex: 1, width: '100%', border: 'none' }}
              title="Sample Behavioral Health Report"
            />
          </div>
        </div>
      )}

      {/* ── Request a Demo modal ─────────────────────────────────────────────── */}
      {/* ── CSV preview modal ─────────────────────────────────────────────────── */}
      {csvOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setCsvOpen(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,20,40,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setCsvOpen(false)} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a6fa5', margin: '0 0 4px' }}>Raw data export</p>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', margin: '0 0 4px', letterSpacing: '-0.2px' }}>Every response, as a structured CSV</h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  In addition to the synthesized insights and charts, you can export the full dataset at any time.
                </p>
              </div>
              <button onClick={() => setCsvOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1, flexShrink: 0, padding: '2px 4px' }}>✕</button>
            </div>
            {/* Callout */}
            <div style={{ margin: '16px 28px 0', padding: '12px 16px', background: '#f0f5ff', borderRadius: 10, borderLeft: '3px solid #4a6fa5', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#1a2744', lineHeight: 1.55 }}>
                <strong>You get both.</strong> Your report surfaces synthesized insights, flags, and charts automatically. The CSV gives you full flexibility to slice the data in your own tools. Filter by school, grade, score range, or any dimension you need.
              </p>
            </div>
            {/* Table */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, margin: '16px 0 0' }}>
              <table style={{ fontSize: 11, whiteSpace: 'nowrap', borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#1a2744', position: 'sticky', top: 0 }}>
                    {CSV_COLS.map((col, ci) => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', background: '#1a2744' }}>
                        {ci === 10
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{col} <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg></span>
                          : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CSV_ROWS.map((row, i) => {
                    const score = parseInt(row[10], 10);
                    const { bg: scoreBg, text: scoreText } = scoreColor(score);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                        {row.map((cell, j) => {
                          if (j === 10) return (
                            <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, textAlign: 'center', background: scoreBg, color: scoreText }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{cell}<span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}>/800</span></span>
                            </td>
                          );
                          if (j === 4 || j === 6 || j === 8) return (
                            <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', color: '#4b5563', maxWidth: 180 }}>
                              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{cell}</span>
                            </td>
                          );
                          if (j === 12) {
                            const isHigh = cell.toLowerCase().includes('high') || cell.toLowerCase().includes('strong');
                            return (
                              <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6' }}>
                                <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: isHigh ? '#d1fae5' : '#fef3c7', color: isHigh ? '#065f46' : '#92400e' }}>{cell}</span>
                              </td>
                            );
                          }
                          if (j === 13) return (
                            <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6' }}>
                              <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: '#dbeafe', color: '#1e40af' }}>{cell}</span>
                            </td>
                          );
                          if (j === 14) return (
                            <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6' }}>
                              <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: '#f0f5fb', color: '#1a2744' }}>{cell}</span>
                            </td>
                          );
                          if (j === 11) return (
                            <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', fontStyle: 'italic', color: '#6b7280' }}>
                              <span style={{ display: 'block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell}</span>
                            </td>
                          );
                          return (
                            <td key={j} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', color: '#4b5563' }}>
                              <span style={{ display: 'block', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 10, color: '#9ca3af' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#d1fae5', display: 'inline-block' }} />600+</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#fef9c3', display: 'inline-block' }} />500–599</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#fed7aa', display: 'inline-block' }} />400–499</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#fee2e2', display: 'inline-block' }} />&lt;400</span>
              </div>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Sample anonymized data — 6 of N rows shown</span>
            </div>
          </div>
        </div>
      )}

      {demoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) { setDemoOpen(false); setDemoSuccess(false); setDemoError(''); setDemoForm({ name:'',email:'',org:'',phone:'',notes:'' }); } }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,20,40,0.6)', backdropFilter: 'blur(6px)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <button onClick={() => { setDemoOpen(false); setDemoSuccess(false); setDemoError(''); setDemoForm({ name:'',email:'',org:'',phone:'',notes:'' }); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1 }}>✕</button>

            {demoSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" fill="none" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2744', margin: '0 0 8px' }}>You&apos;re on the list!</h2>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>We&apos;ll reach out within 1–2 business days to schedule a time. Check your inbox for a confirmation.</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a2744', margin: '0 0 6px', letterSpacing: '-0.3px' }}>Request a Demo</h2>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px', lineHeight: 1.5 }}>Leave your info and we&apos;ll reach out to set up a time.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {([
                    { key: 'name', label: 'Full Name', placeholder: 'Jane Smith', required: true },
                    { key: 'email', label: 'Work Email', placeholder: 'jane@district.org', required: true },
                    { key: 'org', label: 'Organization', placeholder: 'School or district name', required: true },
                    { key: 'phone', label: 'Phone (optional)', placeholder: '(555) 000-0000', required: false },
                  ] as const).map(({ key, label, placeholder, required }) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                      <input
                        type={key === 'email' ? 'email' : 'text'}
                        placeholder={placeholder}
                        value={demoForm[key]}
                        onChange={e => setDemoForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => (e.target.style.borderColor = '#4a6fa5')}
                        onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Anything you&apos;d like us to know? (optional)</label>
                    <textarea
                      placeholder="Tell us a bit about what you're looking for..."
                      value={demoForm.notes}
                      onChange={e => setDemoForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#111827', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      onFocus={e => (e.target.style.borderColor = '#4a6fa5')}
                      onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  {demoError && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{demoError}</p>}
                  <button
                    disabled={demoSubmitting}
                    onClick={async () => {
                      if (!demoForm.name || !demoForm.email || !demoForm.org) { setDemoError('Please fill in the required fields.'); return; }
                      setDemoError(''); setDemoSubmitting(true);
                      try {
                        const res = await fetch('/api/demo-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demoForm) });
                        if (!res.ok) throw new Error();
                        setDemoSuccess(true);
                      } catch { setDemoError('Something went wrong. Please try again.'); }
                      finally { setDemoSubmitting(false); }
                    }}
                    style={{ background: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 100%)', color: 'white', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: demoSubmitting ? 'wait' : 'pointer', opacity: demoSubmitting ? 0.7 : 1, letterSpacing: '-0.01em' }}>
                    {demoSubmitting ? 'Sending…' : 'Request a Demo →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Intake Form (full-screen overlay) ────────────────────────────────── */}
      {formOpen && (
        <div ref={formRef} className="fixed inset-0 z-40 bg-white flex flex-col overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-0 shrink-0" style={{ background: '#1a2744' }}>
            <a href="https://impacterpathway.com" target="_blank" rel="noopener noreferrer">
              <img src="/Logo_Transparent_Background.png" alt="Impacter Pathway" style={{ height: 72 }} />
            </a>
            <button onClick={() => setFormOpen(false)} className="p-1 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Scrollable form body */}
          <div ref={scrollBodyRef} className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 py-10">

            {/* Step indicator */}
            {step < 7 && (() => {
              const steps = [
                {n:1,l:'Assessment'},
                {n:2,l:'Offerings'},
                {n:3,l:'Customizations'},
                {n:4,l:'Dates & Details'},
                {n:5,l:'Contact'},
              ];
              return (
                <div className="flex items-center gap-1.5 mb-8">
                  {steps.map(({ n, l }, i) => (
                    <div key={n} className="flex items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        step === n ? 'text-white' :
                        step > n  ? '' : 'bg-gray-200 text-gray-400'
                      }`} style={step === n ? { background: '#4a6fa5' } : step > n ? { background: '#dce8f5', color: '#4a6fa5' } : {}}>{n}</div>
                      <span className={`text-xs hidden sm:inline ${step === n ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{l}</span>
                      {i < steps.length - 1 && <div className={`h-px w-5 mx-1 transition-colors ${step > n ? '' : 'bg-gray-200'}`} style={step > n ? { background: '#a8c2e0' } : {}} />}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Step 1: Assessment + respondents + grades + goal ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Which assessment fits your goals?</h3>
                  <p className="text-sm text-gray-500 mb-5">Pick the one that matches what you&apos;re trying to learn.</p>
                </div>
                <div className="space-y-3">
                  {ASSESSMENT_TYPES.map(({ id, label, description }) => {
                    const selected = form.assessmentType === id;
                    const thisIsCS = id === 'community-schools';
                    const thisStudentsSelected = thisIsCS && form.respondents.includes('Students');
                    return (
                      <div key={id}>
                        <button
                          type="button"
                          onClick={() => set('assessmentType', id)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                            selected ? 'border-[#4a6fa5] bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <p className={`text-sm font-semibold mb-0.5 ${selected ? 'text-[#1a2744]' : 'text-gray-800'}`}>{label}</p>
                          <p className="text-xs text-gray-500">{description}</p>
                        </button>

                        {selected && (
                          <div className="mt-3 space-y-4 pl-1">
                            {thisIsCS && (
                              <MultiCheck
                                label="Who will be responding? *"
                                options={['Students', 'Families / Parents', 'Staff']}
                                value={form.respondents}
                                onChange={v => set('respondents', v)}
                              />
                            )}
                            {(!thisIsCS || thisStudentsSelected) && (
                              <MultiCheck
                                label="Which grade levels? *"
                                options={GRADE_BANDS}
                                value={form.gradeLevels}
                                onChange={v => set('gradeLevels', v)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <ContinueBtn reason={step1Reason()} onClick={() => setStep(2)} />
                </div>
              </div>
            )}


            {/* ── Step 3: Customizations ────────────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Customize your assessment</h3>
                  <p className="text-sm text-gray-500 mb-2">Choose the languages and modalities you want to enable.</p>
                </div>

                {/* Languages */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Which languages do you want to enable?<span className="text-red-500 ml-0.5">*</span></p>
                  <div className="flex flex-wrap gap-2">
                    {['English', 'Spanish', 'Other'].map(lang => {
                      const checked = form.languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? form.languages.filter(l => l !== lang)
                              : [...form.languages, lang];
                            set('languages', next);
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            checked ? 'text-white border-[#4a6fa5]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#4a6fa5]/40'
                          }`}
                          style={checked ? { background: '#4a6fa5' } : undefined}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                  {form.languages.includes('Other') && (
                    <input
                      className={INPUT_CLS + ' mt-2'}
                      placeholder="Which language(s)?"
                      value={form.otherLanguage}
                      onChange={e => set('otherLanguage', e.target.value)}
                    />
                  )}
                </div>

                {/* Modalities */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Which response modalities do you want to enable?<span className="text-red-500 ml-0.5">*</span></p>
                  <div className="space-y-2">
                    {[
                      { id: 'Video',  note: null },
                      { id: 'Audio',  note: null },
                      { id: 'Text',   note: 'Text can improve completion rates — especially with adults — but voice responses tend to produce richer, more authentic data. We recommend starting with video and audio.' },
                    ].map(({ id, note }) => {
                      const checked = form.modalities.includes(id);
                      return (
                        <div key={id}>
                          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'border-[#4a6fa5]/50 bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? form.modalities.filter(m => m !== id)
                                  : [...form.modalities, id];
                                set('modalities', next);
                              }}
                              className="accent-[#4a6fa5] w-4 h-4"
                            />
                            <span className="text-sm text-gray-700 font-medium">{id}</span>
                          </label>
                          {note && checked && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-1">{note}</p>
                          )}
                          {note && !checked && (
                            <p className="text-xs text-gray-400 px-3 mt-0.5">{note}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom intro */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Would you like to record a custom intro for your assessment?
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    A short video from a familiar face — a principal, counselor, or teacher — can put students at ease before they respond. Here&apos;s an example from Western Placer USD:
                  </p>
                  <IntroVideoPlayer src="https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/IMG_2879_V1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvSU1HXzI4NzlfVjEubXA0IiwiaWF0IjoxNzc2MTYyNDY4LCJleHAiOjIwOTE1MjI0Njh9.JFWdFqjbRy5X5OISoB_c0eiAySB895E9urI6ua1L1fk" />
                  <div className="space-y-2 mt-3">
                    {([
                      { value: 'yes',    label: 'Yes — I\'d love to record a custom intro' },
                      { value: 'no',     label: 'No thanks, the standard intro is fine' },
                      { value: 'unsure', label: 'Not sure yet' },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.wantsCustomIntro === value
                          ? 'border-[#4a6fa5] bg-[#f0f5fb]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <input type="radio" name="wantsCustomIntro" value={value}
                          checked={form.wantsCustomIntro === value}
                          onChange={() => set('wantsCustomIntro', value)}
                          className="accent-[#4a6fa5]" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Demographics opt-in */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Want respondents to share demographic info?</p>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    FERPA and COPPA compliant. Pilot assessments don&apos;t require student enrollment or integration with systems like Clever or ClassLink — no PII is collected unless you opt in below. Any fields you enable are voluntary for respondents and let you disaggregate results by group.
                  </p>
                  <div className="space-y-2">
                    {['School', 'Grade', 'Gender'].map(opt => {
                      const checked = form.demographics.includes(opt);
                      return (
                        <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          checked ? 'border-[#4a6fa5]/50 bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => {
                              const next = checked
                                ? form.demographics.filter(d => d !== opt)
                                : [...form.demographics.filter(d => d !== 'None'), opt];
                              set('demographics', next);
                            }}
                            className="accent-[#4a6fa5] w-4 h-4" />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      );
                    })}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.demographics.includes('Other') ? 'border-[#4a6fa5]/50 bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                      <input type="checkbox" checked={form.demographics.includes('Other')}
                        onChange={() => {
                          const c = form.demographics.includes('Other');
                          set('demographics', c
                            ? form.demographics.filter(d => d !== 'Other')
                            : [...form.demographics.filter(d => d !== 'None'), 'Other']);
                        }}
                        className="accent-[#4a6fa5] w-4 h-4" />
                      <span className="text-sm text-gray-700">Other</span>
                    </label>
                    {form.demographics.includes('Other') && (
                      <input className={INPUT_CLS + ' mt-1'} placeholder="Which demographic field(s)?"
                        value={form.demographicsOther} onChange={e => set('demographicsOther', e.target.value)} />
                    )}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.demographics.includes('None') ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                      <input type="checkbox" checked={form.demographics.includes('None')}
                        onChange={() => {
                          set('demographics', form.demographics.includes('None') ? [] : ['None']);
                          set('demographicsOther', '');
                        }}
                        className="accent-gray-400 w-4 h-4" />
                      <span className="text-sm text-gray-500">No thanks</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <ContinueBtn reason={step3Reason()} onClick={() => setStep(4)} />
                </div>
              </div>
            )}

            {/* ── Step 4: Dates & Details ────────────────────────── */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Dates &amp; Details</h3>
                  <p className="text-sm text-gray-500">Give us your best guess — we&apos;ll follow up to confirm the final window.</p>
                </div>

                <Field label="When would you like to launch?" required>
                  <select value={form.launchTimeline} onChange={e => set('launchTimeline', e.target.value)} className={SELECT_CLS}>
                    <option value="">Select a timeline…</option>
                    <option>As soon as possible</option>
                    <option>Within the next month</option>
                    <option>Within the next 2–3 months</option>
                    <option>By end of this school year</option>
                    <option>Start of next school year</option>
                    <option>Just exploring for now</option>
                  </select>
                </Field>

                <Field label="Any important dates or constraints we should know about?">
                  <textarea
                    value={form.dateNotes}
                    onChange={e => set('dateNotes', e.target.value)}
                    placeholder="e.g. Avoid testing windows, spring break Mar 24–28, prefer mornings…"
                    rows={3}
                    className={INPUT_CLS + ' resize-none'}
                  />
                </Field>

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

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Would you like an Impacter team member to support on-site during implementation?
                  </p>
                  <div className="space-y-2">
                    {([
                      { value: 'yes',    label: 'Yes please — on-site support would be helpful' },
                      { value: 'no',     label: 'No, we will handle implementation independently' },
                      { value: 'unsure', label: 'Not sure yet' },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.onsiteSupport === value
                          ? 'border-[#4a6fa5] bg-[#f0f5fb]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <input type="radio" name="onsiteSupport" value={value}
                          checked={form.onsiteSupport === value}
                          onChange={() => set('onsiteSupport', value)}
                          className="accent-[#4a6fa5]" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <ContinueBtn reason={step4Reason()} onClick={() => setStep(5)} />
                </div>
              </div>
            )}

            {/* ── Step 2: CS Question selector ──────────────────── */}
            {step === 2 && isCS && (() => {
              const sections = getCsSections();
              return (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Build your assessment</h3>
                    <p className="text-sm text-gray-500">
                      For each respondent group, choose one question per pillar — or use the standard pre-built assessment.
                    </p>
                  </div>

                  {sections.map(({ key, label }) => {
                    const mode = csMode[key] ?? 'standard';
                    const preview = CS_PREVIEWS[key];

                    return (
                      <div key={key} className="border border-gray-200 rounded-2xl overflow-hidden">
                        {/* Section header */}
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p className="text-sm font-semibold text-gray-800">{label}</p>
                          <button onClick={() => setSflId(`cs-${key}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#4a6fa5', background: 'white', border: '1px solid #c5d5e8', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                            Save for later
                          </button>
                        </div>

                        <div className="p-5 space-y-5">
                          {/* Embedded preview */}
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>Sample Question</p>
                            <CSVideoPlayer
                              src={preview.videoUrl}
                              question={preview.question}
                              pillar={preview.pillar}
                            />
                          </div>

                          {/* Mode selector */}
                          <div className="space-y-2">
                            {([
                              { v: 'standard'  as const, l: 'Standard', sub: 'Our recommended prompts, ready to go.' },
                              { v: 'custom'    as const, l: 'Customize', sub: 'Pick one prompt per pillar from our library.' },
                              { v: 'write-own' as const, l: 'Build your own', sub: 'We\'ll design custom questions with you.' },
                            ]).map(({ v, l, sub }) => (
                              <label key={v} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                mode === v ? 'border-[#4a6fa5] bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}>
                                <input type="radio" name={`mode-${key}`} value={v} checked={mode === v}
                                  onChange={() => setCsMode(m => ({ ...m, [key]: v }))}
                                  className="accent-[#4a6fa5] mt-0.5" />
                                <span>
                                  <span className="text-sm font-medium text-gray-800">{l}</span>
                                  <span className="text-xs text-gray-500 block">{sub}</span>
                                </span>
                              </label>
                            ))}
                          </div>

                          {/* Standard: show the default questions inline */}
                          {mode === 'standard' && (
                            <div className="border-t border-gray-100 pt-4 space-y-3">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Standard questions</p>
                              {([1,2,3,4] as const).map(pillar => {
                                const defaultQ = CS_QUESTIONS.find(q => q.age === key && q.p === pillar && q.def);
                                if (!defaultQ) return null;
                                return (
                                  <div key={pillar} className="rounded-lg border border-[#4a6fa5]/20 bg-[#f8fafd] px-4 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#4a6fa5' }}>
                                      Pillar {pillar} — {PILLARS[pillar]}
                                    </p>
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{defaultQ.text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Custom: pick one per pillar */}
                          {mode === 'custom' && (() => {
                            const donePillars = ([1,2,3,4] as const).filter(p => !!csPicks[key]?.[p]).length;
                            return (
                              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Progress dots */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {([1,2,3,4] as const).map(p => (
                                    <div key={p} style={{ width: 32, height: 4, borderRadius: 3, background: csPicks[key]?.[p] ? '#4a6fa5' : '#e5e7eb' }} />
                                  ))}
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{donePillars} of 4 selected</span>
                                </div>
                                {/* Pillars */}
                                {([1,2,3,4] as const).map(pillar => {
                                  const qs = CS_QUESTIONS.filter(q => q.age === key && q.p === pillar);
                                  const selected = csPicks[key]?.[pillar];
                                  return (
                                    <div key={pillar} style={{ borderLeft: `3px solid ${selected ? '#4a6fa5' : '#d1d5db'}`, borderRadius: '0 8px 8px 0', background: selected ? '#f0f5fb' : '#f8fafd', padding: '10px 14px' }}>
                                      {/* Pillar label row */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: selected ? '#4a6fa5' : '#9ca3af' }}>Pillar {pillar}</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{PILLARS[pillar]}</span>
                                        {selected && (
                                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#4a6fa5', display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Done
                                          </span>
                                        )}
                                      </div>
                                      {/* Question blocks */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {qs.map(q => {
                                          const isSelected = selected === q.id;
                                          return (
                                            <button key={q.id} type="button"
                                              onClick={() => setCsPicks(p => ({ ...p, [key]: { ...(p[key] ?? {}), [pillar]: q.id } }))}
                                              style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: 'none', background: isSelected ? '#4a6fa5' : 'white', color: isSelected ? 'white' : '#374151', fontSize: 13, lineHeight: 1.5, cursor: 'pointer', width: '100%' }}>
                                              {q.text.replace(/\n/g, ' ')}
                                              {q.def && !isSelected && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#4a6fa5', background: '#f0f5fb', padding: '2px 6px', borderRadius: 20 }}>standard</span>}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-between pt-2">
                    <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                    <ContinueBtn reason={csReason()} onClick={() => setStep(3)} />
                  </div>
                </div>
              );
            })()}

            {/* ── Step 2: BH screener display ───────────────────── */}
            {step === 2 && isBH && (() => {
              const screeners = getBHScreeners();
              return (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Behavioral Health Screeners</h3>
                    <p className="text-sm text-gray-500">
                      Based on your selected grade levels, here are the available screeners. Review the questions, then choose which assessments you'd like to include.
                    </p>
                  </div>

                  {screeners.length === 0 && (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                      No screeners match your selected grade levels. Go back and select at least one student grade band.
                    </p>
                  )}

                  {screeners.map(s => (
                    <div key={s.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="bg-gray-50 px-5 py-3 border-b border-gray-200" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.grades}</p>
                        </div>
                        <button onClick={() => setSflId(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#4a6fa5', background: 'white', border: '1px solid #c5d5e8', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                          Save for later
                        </button>
                      </div>
                      <div className="p-5 space-y-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>Sample Question</p>
                        <CSVideoPlayer
                          src={s.videoUrl}
                          pillar={s.videoPillar}
                          question={s.videoQuestion}
                        />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Questions</p>
                        <div className="space-y-3">
                          {s.questions.map((q, i) => (
                            <div key={i} className="rounded-lg border border-[#4a6fa5]/20 bg-[#f8fafd] px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#4a6fa5' }}>
                                {q.pillar}
                              </p>
                              <p className="text-sm text-gray-700 leading-relaxed">{q.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Selection */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Which assessments would you like to include in your pilot? *</p>
                    <div className="space-y-2">
                      {screeners.map(s => {
                        const checked = form.bhSelectedAssessments.includes(s.id);
                        return (
                          <label key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'border-[#4a6fa5]/50 bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? form.bhSelectedAssessments.filter(id => id !== s.id)
                                  : [...form.bhSelectedAssessments, s.id];
                                set('bhSelectedAssessments', next);
                              }}
                              className="accent-[#4a6fa5] w-4 h-4" />
                            <span className="text-sm text-gray-700">{s.name}</span>
                          </label>
                        );
                      })}
                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.bhWantsCustom ? 'border-[#4a6fa5]/50 bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <input type="checkbox" checked={form.bhWantsCustom}
                          onChange={() => set('bhWantsCustom', !form.bhWantsCustom)}
                          className="accent-[#4a6fa5] w-4 h-4" />
                        <span className="text-sm text-gray-700">I'm interested in building something custom</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                    <ContinueBtn reason={bhReason()} onClick={() => setStep(3)} />
                  </div>
                </div>
              );
            })()}

            {/* ── Step 2: LP offerings ──────────────────────────── */}
            {step === 2 && isLP && (() => {
              const assessments = getLPAssessments();
              return (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Learner Portrait Offerings</h3>
                    <p className="text-sm text-gray-500">
                      For each assessment, choose how you'd like to set up the questions.
                    </p>
                  </div>

                  {assessments.length === 0 && (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                      No assessments match your selected grade levels. Go back and select at least one grade band.
                    </p>
                  )}

                  {assessments.map(a => {
                    const mode = lpMode[a.id] ?? 'standard';
                    const allQs = LP_QUESTIONS.filter(q => q.band === a.id);
                    const standardQs = allQs.filter(q => q.def);
                    const picks = lpPicks[a.id] ?? [];
                    const isLittles = a.id === 'lp-littles';

                    return (
                      <div key={a.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                            <p className="text-xs text-gray-400">{a.grades}</p>
                          </div>
                          <button onClick={() => setSflId(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#4a6fa5', background: 'white', border: '1px solid #c5d5e8', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                            Save for later
                          </button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>Sample Question</p>
                          <CSVideoPlayer
                            src={a.videoUrl}
                            pillar={a.videoPillar}
                            question={a.videoQuestion}
                          />

                          {/* Mode selector */}
                          <div className="space-y-2">
                            {([
                              { v: 'standard'  as const, l: 'Standard',       sub: 'Our recommended prompts, ready to go.' },
                              { v: 'custom'    as const, l: 'Customize',       sub: isLittles ? 'Pick 3 prompts from the full library.' : 'Choose up to 6 attributes, then pick your prompts.' },
                              { v: 'write-own' as const, l: 'Build your own',  sub: "We'll design custom questions with you." },
                            ]).map(({ v, l, sub }) => (
                              <label key={v} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                mode === v ? 'border-[#4a6fa5] bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}>
                                <input type="radio" name={`lp-mode-${a.id}`} value={v} checked={mode === v}
                                  onChange={() => setLpMode(m => ({ ...m, [a.id]: v }))}
                                  className="accent-[#4a6fa5] mt-0.5" />
                                <span>
                                  <span className="text-sm font-medium text-gray-800">{l}</span>
                                  <span className="text-xs text-gray-500 block">{sub}</span>
                                </span>
                              </label>
                            ))}
                          </div>

                          {/* Standard: show standard questions */}
                          {mode === 'standard' && (
                            <div className="border-t border-gray-100 pt-4 space-y-3">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Standard questions</p>
                              {standardQs.map(q => (
                                <div key={q.id} className="rounded-lg border border-[#4a6fa5]/20 bg-[#f8fafd] px-4 py-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#4a6fa5' }}>{q.attribute}</p>
                                  <p className="text-sm text-gray-700 leading-relaxed">{q.prompt}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Custom: Littles — pick up to 3 */}
                          {mode === 'custom' && isLittles && (() => {
                            const picks = lpPicks[a.id] ?? [];
                            return (
                              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>Choose your questions</span>
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{picks.length}/3 selected</span>
                                </div>
                                {allQs.map(q => {
                                  const checked = picks.includes(q.id);
                                  const atMax = picks.length >= 3 && !checked;
                                  return (
                                    <button key={q.id} type="button" disabled={atMax}
                                      onClick={() => {
                                        const next = checked ? picks.filter(id => id !== q.id) : [...picks, q.id];
                                        setLpPicks(p => ({ ...p, [a.id]: next }));
                                      }}
                                      style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: 'none', background: checked ? '#4a6fa5' : atMax ? '#f5f5f5' : '#f9fafb', color: checked ? 'white' : atMax ? '#aaa' : '#374151', fontSize: 13, lineHeight: 1.5, cursor: atMax ? 'not-allowed' : 'pointer', width: '100%', opacity: atMax ? 0.55 : 1 }}>
                                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: checked ? 'rgba(255,255,255,0.7)' : '#4a6fa5', marginBottom: 3 }}>{q.attribute}</span>
                                      {q.prompt}
                                      {q.def && !checked && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#4a6fa5', background: '#f0f5fb', padding: '2px 6px', borderRadius: 20 }}>standard</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Custom: Elementary / Secondary — two-layer: attributes → questions */}
                          {mode === 'custom' && !isLittles && (() => {
                            const attrPicks = lpAttrPicks[a.id] ?? [];
                            const qPicks = lpQPicks[a.id] ?? [];
                            const anchorAttrs   = LP_ATTRIBUTES.filter(la => la.group === 'anchor');
                            const portraitAttrs = LP_ATTRIBUTES.filter(la => la.group === 'portrait');

                            function toggleAttr(attrId: string) {
                              const selected = attrPicks.includes(attrId);
                              const next = selected
                                ? attrPicks.filter(id => id !== attrId)
                                : [...attrPicks, attrId];
                              // remove any question picks that no longer belong to a selected attribute
                              if (selected) {
                                const attr = LP_ATTRIBUTES.find(la => la.id === attrId)!;
                                const stillValid = new Set(
                                  next.flatMap(aid => LP_ATTRIBUTES.find(la => la.id === aid)?.questionIds ?? [])
                                );
                                setLpQPicks(p => ({ ...p, [a.id]: (p[a.id] ?? []).filter(qid => stillValid.has(qid)) }));
                              }
                              setLpAttrPicks(p => ({ ...p, [a.id]: next }));
                            }

                            // group questions by selected chip (no dedup — questions may appear in multiple chips)
                            const qGroups: Array<{ chipName: string; qs: LPQuestion[] }> = [];
                            // For each question, track all chip names that include it AND the primary chip (first in LP_ATTRIBUTES order)
                            const qChipNames = new Map<string, string[]>();
                            const primaryChipForQ = new Map<string, string>();
                            for (const la of LP_ATTRIBUTES) {
                              if (!attrPicks.includes(la.id)) continue;
                              for (const qid of la.questionIds) {
                                const q = LP_QUESTIONS.find(lq => lq.id === qid);
                                if (!q || q.band !== a.id) continue;
                                if (!qChipNames.has(qid)) qChipNames.set(qid, []);
                                qChipNames.get(qid)!.push(la.name);
                                if (!primaryChipForQ.has(qid)) primaryChipForQ.set(qid, la.name);
                              }
                            }
                            for (const la of LP_ATTRIBUTES) {
                              if (!attrPicks.includes(la.id)) continue;
                              const qs = la.questionIds
                                .map(qid => LP_QUESTIONS.find(q => q.id === qid))
                                .filter((q): q is LPQuestion => !!q && q.band === a.id);
                              if (qs.length > 0) qGroups.push({ chipName: la.name, qs });
                            }

                            function AttrChip({ attr }: { attr: LPAttribute }) {
                              const sel = attrPicks.includes(attr.id);
                              const atMax = attrPicks.length >= 6 && !sel;
                              return (
                                <button type="button" disabled={atMax} onClick={() => toggleAttr(attr.id)}
                                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                                    sel ? 'text-white border-[#4a6fa5]'
                                      : atMax ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'
                                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#4a6fa5]/40'
                                  }`}
                                  style={sel ? { background: '#4a6fa5' } : undefined}>
                                  {attr.name}
                                </button>
                              );
                            }

                            return (
                              <div className="border-t border-gray-100 pt-4 space-y-5">
                                {/* Layer 1: attribute selection */}
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Step 1 — Select up to 6 attributes</p>
                                    <span className="text-xs text-gray-400">{attrPicks.length}/6</span>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-medium text-gray-500 mb-2">Impacter Attributes</p>
                                    <div className="flex flex-wrap gap-2">
                                      {anchorAttrs.map(attr => <AttrChip key={attr.id} attr={attr} />)}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-medium text-gray-500 mb-2">Other Common Portrait Competencies</p>
                                    <div className="flex flex-wrap gap-2">
                                      {portraitAttrs.map(attr => <AttrChip key={attr.id} attr={attr} />)}
                                    </div>
                                  </div>
                                </div>

                                {/* Layer 2: question selection (shown once ≥1 attribute selected) */}
                                {attrPicks.length > 0 && (
                                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>Step 2 — Choose your prompts</span>
                                    {qGroups.length === 0 && (
                                      <p className="text-xs text-gray-400">No prompts available for these attributes at this grade level.</p>
                                    )}
                                    {qGroups.map(({ chipName, qs }) => (
                                      <div key={chipName} style={{ borderLeft: '3px solid #4a6fa5', borderRadius: '0 8px 8px 0', background: '#f8fafd', padding: '10px 14px' }}>
                                        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a6fa5', marginBottom: 8 }}>{chipName}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                          {qs.map(q => {
                                            const checked = qPicks.includes(q.id);
                                            const primaryChip = primaryChipForQ.get(q.id) ?? chipName;
                                            const isClaimedByOther = checked && primaryChip !== chipName;
                                            return (
                                              <button key={q.id} type="button" disabled={isClaimedByOther}
                                                onClick={() => {
                                                  if (isClaimedByOther) return;
                                                  const next = [
                                                    ...qPicks.filter(id => (primaryChipForQ.get(id) ?? '') !== primaryChip),
                                                    q.id,
                                                  ];
                                                  setLpQPicks(p => ({ ...p, [a.id]: next }));
                                                }}
                                                style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: 'none', background: isClaimedByOther ? '#f5f5f5' : checked ? '#4a6fa5' : 'white', color: isClaimedByOther ? '#aaa' : checked ? 'white' : '#374151', fontSize: 13, lineHeight: 1.5, cursor: isClaimedByOther ? 'not-allowed' : 'pointer', width: '100%', opacity: isClaimedByOther ? 0.55 : 1 }}>
                                                {q.prompt}
                                                {q.def && !checked && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#4a6fa5', background: '#f0f5fb', padding: '2px 6px', borderRadius: 20 }}>standard</span>}
                                                {isClaimedByOther && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#92400e', background: '#fef3c7', padding: '2px 6px', borderRadius: 20 }}>selected for {primaryChip}</span>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-between pt-2">
                    <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                    <ContinueBtn reason={lpReason()} onClick={() => setStep(3)} />
                  </div>
                </div>
              );
            })()}

            {/* ── Step 5: Contact details ────────────────────────── */}
            {step === 5 && (
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
                  <button onClick={() => setStep(4)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <button
                    disabled={submitting || !canAdvanceContact}
                    onClick={submit}
                    className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}
                    title={!canAdvanceContact ? 'Fill in Name, Email, and School or District to submit.' : undefined}
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 7: Confirmation ───────────────────────────── */}
            {step === 7 && (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#dce8f5' }}>
                  <svg className="w-7 h-7 text-[#4a6fa5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">You are all set, {form.name.split(' ')[0]}.</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                  We received your request and will be in touch at <strong>{form.email}</strong> within 1–2 business days to talk through next steps.
                </p>
                <p className="text-xs text-gray-400 mt-6">
                  Questions in the meantime? Reply to the confirmation email or reach us at{' '}
                  <a href="mailto:info@impacterpathway.com" className="text-[#4a6fa5] hover:underline">info@impacterpathway.com</a>.
                </p>
              </div>
            )}
          </div>
          </div>{/* end scrollable body */}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center" style={{ background: '#1a2744', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>© {new Date().getFullYear()} Impacter Pathway · Schools measure hard skills. We measure the rest.</p>
      </footer>

      {sflId && <SaveForLaterModal id={sflId} onClose={() => setSflId(null)} />}
    </div>
  );
}
