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
  { domain: 'Reflective Growth',     female: 624, male: 548 },
  { domain: 'Relational Awareness',  female: 591, male: 469 },
  { domain: 'Emotional Resilience',  female: 558, male: 501 },
  { domain: 'Self-Insight',          female: 607, male: 542 },
  { domain: 'Conflict Resolution',   female: 572, male: 473 },
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
  { pattern: 'Hopelessness',         g6: 6.43, g7: 4.21, g8: 5.87 },
  { pattern: 'Withdrawal cues',      g6: 3.18, g7: 5.62, g8: 4.09 },
  { pattern: 'Avoidance signals',    g6: 2.74, g7: 3.91, g8: 5.33 },
  { pattern: 'Self-doubt language',  g6: 4.56, g7: 6.88, g8: 7.12 },
  { pattern: 'Help-seeking absence', g6: 1.93, g7: 2.47, g8: 3.85 },
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
  { label: 'Integrated Student Supports',    height: 92, color: '#4a6fa5', score: '0.97' },
  { label: 'Family & Community Engagement',  height: 76, color: '#2d7a5f', score: '0.88' },
  { label: 'Collaborative Leadership',       height: 68, color: '#7c5cbf', score: '0.82' },
  { label: 'Expanded Learning Time',         height: 83, color: '#e07b54', score: '0.93' },
];

// Linguistic tone divergence by stakeholder
const VOICE_TONE = [
  { group: 'Families',  affirming: 68, concern: 22, neutral: 10, signal: 'belonging & partnership' },
  { group: 'Students',  affirming: 54, concern: 31, neutral: 15, signal: 'safety & being seen' },
  { group: 'Staff',     affirming: 41, concern: 44, neutral: 15, signal: 'workload & systemic gaps' },
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
const CS_PREVIEWS: Record<string, { en: string; es: string | null }> = {
  'Elementary School': { en:'https://flex.impacterpathway.com/f0fwulas9?preview', es:null },
  'Middle School':     { en:'https://flex.impacterpathway.com/f0zy1h485?preview', es:null },
  'High School':       { en:'https://flex.impacterpathway.com/fzq8z8vw4?preview', es:null },
  'Parent':            { en:'https://flex.impacterpathway.com/f7u4hz91d?preview', es:null },
  'Staff':             { en:'https://flex.impacterpathway.com/flgxm5ys9?preview', es:null },
};

// ── Behavioral Health screeners ───────────────────────────────────────────────
interface BHScreener {
  id: string;
  name: string;
  grades: string;
  gradeBands: string[];
  previewUrl: string; // append ?preview — actual form IDs to be confirmed
  questions: Array<{ pillar: string; text: string }>;
}

const BH_SCREENERS: BHScreener[] = [
  {
    id: 'bh-littles',
    name: 'Behavioral Health Screener for Littles',
    grades: 'Grades TK+ (Littles)',
    gradeBands: ['Lower Elementary (TK–2)'],
    previewUrl: 'https://flex.impacterpathway.com/fjzzdvxk8?preview',
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
}

const LP_ASSESSMENTS: LPAssessment[] = [
  { id: 'lp-littles',    name: 'Learner Portrait for Littles',    grades: 'Grades TK–2 (Littles)',     gradeBands: ['Lower Elementary (TK–2)'],                               previewUrl: 'https://sdusd.impacterpathway.com/fp9r1r32y?preview' },
  { id: 'lp-elementary', name: 'Learner Portrait for Elementary', grades: 'Grades 3–5 (Elementary)',   gradeBands: ['Elementary (3rd–5th)'],                                  previewUrl: 'https://flex.impacterpathway.com/fn0l89pl3?preview' },
  { id: 'lp-secondary',  name: 'Learner Portrait for Secondary',  grades: 'Grades 6–12 (Secondary)',   gradeBands: ['Middle School (6th–8th)', 'High School (9th–12th)'],    previewUrl: 'https://flex.impacterpathway.com/fwxzy777r?preview' },
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
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
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

function VideoAskEmbed({ url, label, onOpen, height = 200 }: { url: string; label: string; onOpen: () => void; height?: number }) {
  return (
    <div
      className="relative cursor-pointer group rounded-xl overflow-hidden border border-gray-200"
      onClick={onOpen}
      style={{ height }}
    >
      <iframe
        src={url}
        className="w-full h-full pointer-events-none"
        allow="camera *; microphone *; autoplay *; encrypted-media *; fullscreen *; display-capture *"
        title={label}
      />
      <div className="absolute inset-0 flex items-end justify-center pb-3 bg-transparent group-hover:bg-black/5 transition-colors">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-700 px-3 py-1 rounded-full shadow-sm">
          Click to expand
        </span>
      </div>
    </div>
  );
}

export default function PilotClient() {
  const [formOpen, setFormOpen] = useState(false);
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
  const [simShown, setSimShown] = useState(false);
  const [promptPaused, setPromptPaused] = useState(false);
  const promptVideoRef = useRef<HTMLVideoElement>(null);
  const [insightPanel, setInsightPanel] = useState(0);
  const [insightPaused, setInsightPaused] = useState(false);
  const [demoPanel, setDemoPanel] = useState(0);
  const [demoPaused, setDemoPaused] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (insightPaused) return;
    const t = setInterval(() => setInsightPanel(p => (p + 1) % 6), 8000);
    return () => clearInterval(t);
  }, [insightPaused]);

  useEffect(() => {
    if (demoPaused) return;
    const t = setInterval(() => setDemoPanel(p => (p + 1) % 3), 4000);
    return () => clearInterval(t);
  }, [demoPaused]);

  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

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
          onClick={openForm}
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
      <nav className="px-6 py-1.5 flex items-center justify-between" style={{ background: '#1a2744', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, zIndex: 30 }}>
        <a href="https://impacterpathway.com" target="_blank" rel="noopener noreferrer">
          <img src="/Logo_Transparent_Background.png" alt="Impacter Pathway" style={{ height: 54 }} />
        </a>
        <span className="text-xs font-medium px-3 py-1 rounded-full hidden sm:inline-block" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.18)' }}>
          Pilot Program
        </span>
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
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase" style={{ background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block"></span>
            Pilot Program
          </div>
          <h1 className="font-bold leading-tight mb-6 text-white" style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}>
            Hear every voice.<br />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>Know what it means.</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            A structured pilot gives you real, authentic voice data — scored, analyzed, and ready for action — in about a week. No survey scales. No guesswork. Just the visibility you need to understand what&apos;s actually happening across your schools and make decisions with evidence behind them.
          </p>
          {/* Frosted stat chips */}
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            {[['No app download', true], ['Results in days', true], ['English & Spanish', true]].map(([label]) => (
              <div key={label as string} className="flex items-center gap-2 text-sm px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}>
                <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-20 relative" style={{ background: 'linear-gradient(180deg, #f8fafd 0%, #f0f5fb 100%)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-10 text-center" style={{ color: '#4a6fa5' }}>How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                n: '1', color: '#e07b54',
                title: 'Create your assessment',
                body: 'Choose from our ready-to-go prompt sets or build something custom with our team. Standard, customized, or fully co-designed — it takes minutes, not meetings.',
              },
              {
                n: '2', color: '#2d7a5f',
                title: 'Share a link',
                body: 'Respondents click a link and answer 3–6 voice-based questions in their own words. No app download. No login. Minimal class time. Kids love it.',
              },
              {
                n: '3', color: '#4a6fa5',
                title: 'Receive your report',
                body: 'A week after the window closes, we deliver a synthesized report — cross-campus analytics, theme clusters, equity breakdowns, and the standout moments you\'d never get from a checkbox.',
              },
            ].map(({ n, color, title, body }) => (
              <div key={n} className="bg-white rounded-2xl p-6 shadow-sm" style={{ borderTop: `3px solid ${color}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold mb-4 text-white" style={{ background: color }}>{n}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action ─────────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: '#f4f7fc' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8 text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a6fa5' }}>See it in action</h2>
            <p className="text-lg font-semibold text-gray-900">Real assessments from Impacter Pathway partners</p>
          </div>

          {/* Fake player shell */}
          <div style={{ background: '#0d1b2e', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>

            {/* Top bar */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#1a3d6b', color: 'white', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 5 }}>
                  Impacter Pathway
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Behavioral Health Screener</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>San Diego Unified School District</span>
            </div>

            {/* Two-panel body */}
            <div style={{ display: 'flex', minHeight: 400 }}>

              {/* ── Left: question video ── */}
              <div style={{ flex: '0 0 62%', position: 'relative', background: '#09111e', overflow: 'hidden' }}>
                <video
                  ref={promptVideoRef}
                  src="https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/Elem_Middle_1_Reflective_Growth_BHS_V3.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvRWxlbV9NaWRkbGVfMV9SZWZsZWN0aXZlX0dyb3d0aF9CSFNfVjMubXA0IiwiaWF0IjoxNzc2MTQzMTE1LCJleHAiOjIwOTE1MDMxMTV9.cM1GzrU1TGx_-P0XX-IQYEPzVDI2v-9I7wR3W5IyJd0"
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', minHeight: 400, objectFit: 'cover', display: 'block' }}
                  onEnded={() => setPromptPaused(true)}
                />

                {/* Pause / Skip controls */}
                <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8, zIndex: 2 }}>
                  <button
                    onClick={() => {
                      const v = promptVideoRef.current;
                      if (!v) return;
                      if (v.paused) { v.play(); setPromptPaused(false); }
                      else { v.pause(); setPromptPaused(true); }
                    }}
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, minWidth: 36 }}>
                    {promptPaused ? '▶' : '⏸'}
                  </button>
                  <button
                    onClick={() => { const v = promptVideoRef.current; if (v) { v.currentTime = v.duration; } }}
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.02em' }}>
                    Skip ››
                  </button>
                </div>

                {/* Question overlay at bottom */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)', padding: '48px 22px 22px', zIndex: 2 }}>
                  <p style={{ color: '#60a5fa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                    Assessment Prompt · Reflective Growth
                  </p>
                  <p style={{ color: 'white', fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                    &ldquo;What&apos;s something you&apos;re better at now than you used to be? And what do you think helped you get there?&rdquo;
                  </p>
                </div>
              </div>

              {/* ── Right: response panel ── */}
              <div style={{ flex: '1', background: '#0d1b2e', padding: '36px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0, position: 'relative', overflow: 'hidden' }}>
                {!simShown ? (
                  <>
                    <p style={{ color: 'white', fontSize: 18, fontWeight: 600, margin: '0 0 24px' }}>
                      How would you like to answer?
                    </p>

                    {/* Response mode buttons */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                      {([
                        { label: 'VIDEO', icon: (
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/>
                          </svg>
                        )},
                        { label: 'AUDIO', icon: (
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/>
                          </svg>
                        )},
                        { label: 'TEXT', icon: (
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        )},
                      ] as const).map(({ label, icon }) => (
                        <button key={label} style={{ flex: 1, background: '#1a3558', border: '1.5px solid #2a4f7a', borderRadius: 10, padding: '16px 8px 12px', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1e4068')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#1a3558')}
                        >
                          {icon}
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Practice link */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10a7 7 0 0 1-14 0"/>
                      </svg>
                      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Practice before sending</span>
                    </div>

                    {/* Simulate button */}
                    <button
                      onClick={() => setSimShown(true)}
                      style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: 10, padding: '16px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(34,197,94,0.35)', letterSpacing: '0.01em' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      Simulate a Student Response
                    </button>
                  </>
                ) : (
                  /* ── Student response panel — fills full right panel ── */
                  <div style={{ position: 'absolute', inset: 0, background: '#09111e', display: 'flex', flexDirection: 'column' }}>
                    {/* Label bar */}
                    <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                        Student Response
                      </p>
                      <button
                        onClick={() => setSimShown(false)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                      >
                        ← Back
                      </button>
                    </div>
                    {/* Video fills remaining space */}
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                      <video
                        src="https://juxmpktotvnkvwnmuajz.supabase.co/storage/v1/object/sign/Videos/ninja.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZThjMWZkOC05MTVkLTQ3MzYtYTE2Mi1lYWM4MDIyZjM1ZGQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJWaWRlb3MvbmluamEubXA0IiwiaWF0IjoxNzc2MTQzMTU4LCJleHAiOjIwOTE1MDMxNTh9.5wghUx912E7YtyaBGOX9wxnpUhjK3E8BHyCPG9py6IM"
                        autoPlay
                        playsInline
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {/* Next Question overlay button */}
                      <button
                        style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.01em' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                      >
                        Next Question
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sample data ──────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Sample output</h2>
              <p className="font-semibold text-gray-800">What the dataset looks like — anonymized example data</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'rgba(224,123,84,0.1)', color: '#e07b54', border: '1px solid rgba(224,123,84,0.3)' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ML-scored &amp; analyzed
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs whitespace-nowrap border-collapse w-full">
              <thead>
                <tr style={{ background: '#1a2744' }}>
                  {CSV_COLS.map((col, ci) => (
                    <th key={col} className="px-3 py-2.5 text-left font-semibold border-b border-white/10 text-white/80 sticky top-0" style={{ background: '#1a2744' }}>
                      {ci === 10 ? (
                        <span className="flex items-center gap-1">
                          {col}
                          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                        </span>
                      ) : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CSV_ROWS.map((row, i) => {
                  const score = parseInt(row[10], 10);
                  const { bg: scoreBg, text: scoreText } = scoreColor(score);
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                      {row.map((cell, j) => {
                        // Score column (index 10 after removing Ethnicity)
                        if (j === 10) {
                          return (
                            <td key={j} className="px-3 py-2 border-b border-gray-100 font-bold text-center" style={{ background: scoreBg, color: scoreText }}>
                              <span className="inline-flex items-center gap-1">
                                {cell}
                                <span className="text-[10px] font-normal opacity-60">/800</span>
                              </span>
                            </td>
                          );
                        }
                        // Q response columns (4, 6, 8)
                        if (j === 4 || j === 6 || j === 8) {
                          return (
                            <td key={j} className="px-3 py-2 border-b border-gray-100 text-gray-600 max-w-[200px]">
                              <span className="block overflow-hidden text-ellipsis" style={{ maxWidth: 180 }}>{cell}</span>
                              <a href="#" onClick={e => e.preventDefault()} className="text-[10px] font-medium mt-0.5 block" style={{ color: '#4a6fa5' }}>View response →</a>
                            </td>
                          );
                        }
                        // Community Signal (index 12)
                        if (j === 12) {
                          const isHigh = cell.toLowerCase().includes('high') || cell.toLowerCase().includes('strong');
                          return (
                            <td key={j} className="px-3 py-2 border-b border-gray-100">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${isHigh ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{cell}</span>
                            </td>
                          );
                        }
                        // Unmet Need (index 13)
                        if (j === 13) {
                          return (
                            <td key={j} className="px-3 py-2 border-b border-gray-100">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{cell}</span>
                            </td>
                          );
                        }
                        // Next Step (index 14)
                        if (j === 14) {
                          return (
                            <td key={j} className="px-3 py-2 border-b border-gray-100">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#f0f5fb', color: '#1a2744' }}>{cell}</span>
                            </td>
                          );
                        }
                        // Language Style (index 11)
                        if (j === 11) {
                          return (
                            <td key={j} className="px-3 py-2 border-b border-gray-100 italic text-gray-500 text-[11px]">
                              <span className="block max-w-[160px] overflow-hidden text-ellipsis">{cell}</span>
                            </td>
                          );
                        }
                        return (
                          <td key={j} className="px-3 py-2 border-b border-gray-100 text-gray-600">
                            <span className="block max-w-[120px] overflow-hidden text-ellipsis">{cell}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end mt-3 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#d1fae5' }}></span>600+</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#fef9c3' }}></span>500–599</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#fed7aa' }}></span>400–499</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#fee2e2' }}></span>&lt;400</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sample Report Insights ───────────────────────────────────────────── */}
      <section className="border-b border-gray-100 py-14" style={{ background: '#f4f7fc' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Sample report insights</p>
              <h2 className="text-xl font-bold text-gray-900">What you can&apos;t get from a survey.</h2>
            </div>
            {/* Panel nav dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <button key={i} onClick={() => setInsightPanel(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: insightPanel === i ? 20 : 8,
                    height: 8,
                    background: insightPanel === i ? '#4a6fa5' : '#c8d9ef',
                  }} />
              ))}
            </div>
          </div>

          {/* Panels */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#1a2744', minHeight: 420 }}
            onMouseEnter={() => setInsightPaused(true)}
            onMouseLeave={() => setInsightPaused(false)}>

            {/* ── Panel 0: BH Domains by Gender ── */}
            {insightPanel === 0 && (
              <div className="p-8 flex flex-col gap-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Behavioral Health · Domain Analysis</p>
                    <h3 className="text-lg font-bold text-white leading-snug">Girls outscore boys by up to 122 pts —<br/>the gap widest in relational skills.</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: '#4a6fa5' }}></span>Female</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,0.25)' }}></span>Male</span>
                  </div>
                </div>
                <svg viewBox="0 0 620 260" className="w-full" style={{ maxHeight: 260 }}>
                  {/* X-axis tick marks at 200, 400, 600, 800 */}
                  {[200, 400, 600, 800].map(v => {
                    const px = 173 + ((v - 0) / 800) * 400;
                    return (
                      <g key={v}>
                        <line x1={px} y1="0" x2={px} y2="250" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        <text x={px} y="258" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.25)">{v}</text>
                      </g>
                    );
                  })}
                  {(() => {
                    const maxGap = Math.max(...BH_DOMAIN_DATA.map(d => d.female - d.male));
                    return BH_DOMAIN_DATA.map((d, i) => {
                      const yCenter = 26 + i * 44;
                      const maxW = 400;
                      const scaleW = (v: number) => (v / 800) * maxW;
                      const gap = d.female - d.male;
                      return (
                        <g key={d.domain}>
                          <text x="168" y={yCenter - 2} textAnchor="end" fontSize="11.5" fill="rgba(255,255,255,0.6)">{d.domain}</text>
                          {/* Male bar (background) */}
                          <rect x="173" y={yCenter - 16} width={scaleW(d.male)} height={28} rx="4" fill="rgba(255,255,255,0.12)" />
                          {/* Female bar */}
                          <rect x="173" y={yCenter - 16} width={scaleW(d.female)} height={14} rx="4" fill="#4a6fa5" />
                          <text x={177 + scaleW(d.female)} y={yCenter - 5} fontSize="11" fill="#7aa3cc" fontWeight="700">{d.female}</text>
                          <text x={177 + scaleW(d.male)} y={yCenter + 10} fontSize="11" fill="rgba(255,255,255,0.35)" fontWeight="600">{d.male}</text>
                          {/* Gap annotation on widest gap row */}
                          {gap === maxGap && (
                            <g>
                              <line x1={173 + scaleW(d.male)} y1={yCenter - 21} x2={173 + scaleW(d.female)} y2={yCenter - 21} stroke="#f59e0b" strokeWidth="1.5" />
                              <line x1={173 + scaleW(d.male)} y1={yCenter - 24} x2={173 + scaleW(d.male)} y2={yCenter - 18} stroke="#f59e0b" strokeWidth="1.5" />
                              <line x1={173 + scaleW(d.female)} y1={yCenter - 24} x2={173 + scaleW(d.female)} y2={yCenter - 18} stroke="#f59e0b" strokeWidth="1.5" />
                              <text x={173 + scaleW(d.male) + scaleW(gap) / 2} y={yCenter - 27} textAnchor="middle" fontSize="10" fill="#f59e0b" fontWeight="700">+{gap} pts</text>
                            </g>
                          )}
                        </g>
                      );
                    });
                  })()}
                  <line x1="173" y1="0" x2="173" y2="250" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                </svg>
              </div>
            )}

            {/* ── Panel 1: Self-Management Matrix ── */}
            {insightPanel === 1 && (
              <div className="p-8 flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Learner Portrait · Self-Management Matrix</p>
                  <h3 className="text-lg font-bold text-white leading-snug">Students who score high in Purpose are 3.4× more likely<br/>to score high in Self-Control.</h3>
                </div>
                <svg viewBox="0 0 520 290" className="w-full" style={{ maxHeight: 290 }}>
                  <defs>
                    <linearGradient id="wGrad" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1e3a5f" />
                      <stop offset="60%" stopColor="#1e4d6b" />
                      <stop offset="100%" stopColor="#1a5c4a" />
                    </linearGradient>
                  </defs>
                  {/* Chart area: x 55–505, y 10–240 → width 450, height 230 */}
                  <rect x="55" y="10" width="450" height="230" rx="6" fill="url(#wGrad)" />
                  {/* Grid lines at 0.75, 0.80, 0.85, 0.90, 0.95 */}
                  {[75, 80, 85, 90, 95].map(v => {
                    const px = 55 + ((v - 70) / 30) * 450;
                    const py = 240 - ((v - 70) / 30) * 230;
                    return (
                      <g key={v}>
                        <line x1={px} y1="10" x2={px} y2="240" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <line x1="55" y1={py} x2="505" y2={py} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <text x={px} y="255" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">{(v/100).toFixed(2)}</text>
                        <text x="44" y={py + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">{(v/100).toFixed(2)}</text>
                      </g>
                    );
                  })}
                  {/* Axis end labels */}
                  <text x="55" y="255" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">0.70</text>
                  <text x="505" y="255" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">1.00</text>
                  <text x="44" y="243" textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">0.70</text>
                  <text x="44" y="13" textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">1.00</text>
                  {/* Dots */}
                  {WELLNESS_DOTS.map((dot, i) => (
                    <circle key={i}
                      cx={55 + ((dot.x - 70) / 30) * 450}
                      cy={240 - ((dot.y - 70) / 30) * 230}
                      r="3.5" fill="#7aa3cc" fillOpacity="0.8" stroke="#4a6fa5" strokeWidth="1"
                    />
                  ))}
                  {/* Axis labels */}
                  <text x="280" y="272" textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.45)">Purpose</text>
                  <text x="14" y="125" textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.45)" transform="rotate(-90 14 125)">Self-Control</text>
                  {/* Annotation */}
                  <rect x="340" y="16" width="158" height="30" rx="5" fill="rgba(74,111,165,0.35)" />
                  <text x="419" y="30" textAnchor="middle" fontSize="10" fill="#a8c5e0" fontWeight="600">3.4× more likely</text>
                  <text x="419" y="42" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">high Purpose → high Self-Control</text>
                </svg>
              </div>
            )}

            {/* ── Panel 2: Risk Language Heatmap ── */}
            {insightPanel === 2 && (
              <div className="p-8 flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Behavioral Health · Language Frequency</p>
                  <h3 className="text-lg font-bold text-white leading-snug">8th grade self-doubt language peaks at 7.12% —<br/>the highest signal in the cohort.</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th className="text-left pb-3 pr-6 font-medium" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>PATTERN DETECTED</th>
                        {['6th Grade', '7th Grade', '8th Grade'].map(g => (
                          <th key={g} className="text-center pb-3 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{g}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RISK_ROWS.map((row, i) => {
                        const vals = [row.g6, row.g7, row.g8];
                        const maxVal = 7.25;
                        return (
                          <tr key={i}>
                            <td className="py-1.5 pr-6 font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{row.pattern}</td>
                            {vals.map((v, j) => {
                              const intensity = v / maxVal;
                              const bg = `rgba(74, 111, 165, ${0.12 + intensity * 0.78})`;
                              const textColor = intensity > 0.55 ? '#ffffff' : 'rgba(255,255,255,0.6)';
                              return (
                                <td key={j} className="px-2 py-1.5 text-center font-bold rounded-sm"
                                  style={{ background: bg, color: textColor, fontSize: 13 }}>
                                  {v.toFixed(2)}%
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Frequency = % of total spoken words flagged per pattern per grade.</p>
              </div>
            )}

            {/* ── Panel 3: Protective Factors ── */}
            {insightPanel === 3 && (
              <div className="p-8 flex flex-col gap-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Behavioral Health · Protective Signals</p>
                    <h3 className="text-lg font-bold text-white leading-snug">Students who named a trusted adult<br/>scored 2.1× higher on resilience.</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: '#4a6fa5' }}></span>Relational</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: '#2d7a5f' }}></span>Internal</span>
                  </div>
                </div>
                <svg viewBox="0 0 520 240" className="w-full" style={{ maxHeight: 240 }}>
                  {PROTECTIVE_DATA.map((d, i) => {
                    const y = 18 + i * 37;
                    const maxW = 320;
                    const color = d.type === 'relational' ? '#4a6fa5' : '#2d7a5f';
                    const barW = (d.val / 100) * maxW;
                    return (
                      <g key={d.factor}>
                        {/* Track */}
                        <rect x="170" y={y + 3} width={maxW} height={22} rx="4" fill="rgba(255,255,255,0.05)" />
                        {/* Bar */}
                        <rect x="170" y={y + 3} width={barW} height={22} rx="4" fill={color} fillOpacity="0.8" />
                        {/* Circle endpoint */}
                        <circle cx={170 + barW} cy={y + 14} r="8" fill={color} />
                        <text x={170 + barW} y={y + 18} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">{d.val}</text>
                        {/* Label */}
                        <text x="165" y={y + 18} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.6)">{d.factor}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* ── Panel 4: CS Parthenon ── */}
            {insightPanel === 4 && (
              <div className="p-8 flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Community Schools · Pillar Scores</p>
                  <h3 className="text-lg font-bold text-white leading-snug">Student supports lead. Collaborative leadership<br/>is the gap — and the lever.</h3>
                </div>
                <svg viewBox="0 0 520 300" className="w-full" style={{ maxHeight: 300 }}>
                  {/* Ground line */}
                  <rect x="20" y="262" width="480" height="6" rx="3" fill="rgba(255,255,255,0.08)" />
                  {PARTHENON_PILLARS.map((p, i) => {
                    const pillarW = 84;
                    const gap = 20;
                    const totalW = 4 * pillarW + 3 * gap;
                    const startX = (520 - totalW) / 2;
                    const x = startX + i * (pillarW + gap);
                    const maxH = 210;
                    const h = (p.height / 100) * maxH;
                    const y = 262 - h;
                    return (
                      <g key={p.label}>
                        {/* Subtle height guide lines */}
                        <line x1={x} y1={y} x2={x - 6} y2={y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        {/* Pillar */}
                        <rect x={x} y={y} width={pillarW} height={h} rx="5" fill={p.color} fillOpacity="0.75" />
                        {/* Score */}
                        <text x={x + pillarW / 2} y={y + h / 2 - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="white">{p.score}</text>
                        <text x={x + pillarW / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.55)">avg score</text>
                        {/* Cap */}
                        <rect x={x - 5} y={y - 9} width={pillarW + 10} height={9} rx="2" fill={p.color} fillOpacity="0.9" />
                        {/* Label */}
                        <text x={x + pillarW / 2} y={278} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.5)">{p.label.split(' ').slice(0, 2).join(' ')}</text>
                        <text x={x + pillarW / 2} y={290} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.5)">{p.label.split(' ').slice(2).join(' ')}</text>
                      </g>
                    );
                  })}
                  {/* Entablature */}
                  <rect x="14" y="16" width="492" height="12" rx="3" fill="rgba(255,255,255,0.07)" />
                  <rect x="22" y="8" width="476" height="9" rx="2" fill="rgba(255,255,255,0.04)" />
                </svg>
              </div>
            )}

            {/* ── Panel 5: Linguistic Tone Divergence ── */}
            {insightPanel === 5 && (
              <div className="p-8 flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Community Schools · Voice Tone Analysis</p>
                  <h3 className="text-lg font-bold text-white leading-snug">Staff voice carries the most concern language —<br/>44% flagged, vs. 22% from families.</h3>
                </div>
                <svg viewBox="0 0 580 230" className="w-full" style={{ maxHeight: 230 }}>
                  {/* Center axis */}
                  <line x1="290" y1="0" x2="290" y2="230" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3" />
                  <text x="130" y="14" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.3)" fontWeight="600">← CONCERN LANGUAGE</text>
                  <text x="440" y="14" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.3)" fontWeight="600">AFFIRMING LANGUAGE →</text>

                  {VOICE_TONE.map((d, i) => {
                    const rowY = 38 + i * 64;
                    const maxHalf = 250; // each half = 250px wide
                    const affW = (d.affirming / 100) * maxHalf;
                    const conW = (d.concern / 100) * maxHalf;
                    const neuW = (d.neutral / 100) * maxHalf;
                    return (
                      <g key={d.group}>
                        {/* Group label */}
                        <text x="290" y={rowY - 4} textAnchor="middle" fontSize="12" fill="white" fontWeight="700">{d.group}</text>
                        {/* Concern bar (goes left from center) */}
                        <rect x={290 - conW} y={rowY + 2} width={conW} height={28} rx="4" fill="#e07b54" fillOpacity="0.75" />
                        <text x={290 - conW - 6} y={rowY + 20} textAnchor="end" fontSize="11" fill="#e07b54" fontWeight="600">{d.concern}%</text>
                        {/* Neutral (attached left of center) */}
                        <rect x={290 - conW - neuW} y={rowY + 2} width={neuW} height={28} rx="0" fill="rgba(255,255,255,0.1)" />
                        {/* Affirming bar (goes right from center) */}
                        <rect x="290" y={rowY + 2} width={affW} height={28} rx="4" fill="#2d7a5f" fillOpacity="0.75" />
                        <text x={290 + affW + 6} y={rowY + 20} textAnchor="start" fontSize="11" fill="#4aad8a" fontWeight="600">{d.affirming}%</text>
                        {/* Signal chip */}
                        <rect x={290 + affW + 46} y={rowY + 5} width={140} height={20} rx="4" fill="rgba(74,111,165,0.25)" />
                        <text x={290 + affW + 116} y={rowY + 19} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.5)">↑ {d.signal}</text>
                      </g>
                    );
                  })}
                </svg>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Affirming and concern language classified via semantic analysis of open-ended voice responses. This signal is invisible in traditional survey data.</p>
              </div>
            )}

          </div>

          {/* Panel navigation arrows */}
          <div className="flex justify-center gap-3 mt-5">
            <button onClick={() => setInsightPanel(p => (p + 5) % 6)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'white', color: '#4a6fa5', border: '1px solid #d0dff0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={() => setInsightPanel(p => (p + 1) % 6)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'white', color: '#4a6fa5', border: '1px solid #d0dff0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
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

      {/* ── Intake Form (full-screen overlay) ────────────────────────────────── */}
      {formOpen && (
        <div ref={formRef} className="fixed inset-0 z-40 bg-white flex flex-col overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ background: '#1a2744' }}>
            <img src="/Logo_Transparent_Background.png" alt="Impacter Pathway" style={{ height: 32 }} />
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
                            <div>
                              <Field label="What is your primary goal for this pilot?">
                                <select value={form.primaryGoal} onChange={e => set('primaryGoal', e.target.value)} className={SELECT_CLS}>
                                  <option value="">Select one…</option>
                                  <option>LCAP / strategic planning data</option>
                                  <option>Family engagement and outreach</option>
                                  <option>School climate and belonging</option>
                                  <option>Student wellness and behavioral health</option>
                                  <option>Learner skills and competency mapping</option>
                                  <option>Program evaluation</option>
                                  <option>Staff professional learning</option>
                                  <option>Other</option>
                                </select>
                              </Field>
                              {form.primaryGoal === 'Other' && (
                                <input
                                  className={INPUT_CLS + ' mt-2'}
                                  placeholder="Tell us more…"
                                  value={form.primaryGoalOther}
                                  onChange={e => set('primaryGoalOther', e.target.value)}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    disabled={!canAdvanceStep1}
                    onClick={() => setStep(2)}
                    className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}
                  >
                    Continue
                  </button>
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
                  <p className="text-sm font-medium text-gray-700 mb-2">Which languages do you want to enable? *</p>
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
                  <p className="text-sm font-medium text-gray-700 mb-2">Which response modalities do you want to enable? *</p>
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
                  <VideoAskEmbed
                    url="https://wpusd.impacterpathway.com/f78d5omaf?preview"
                    label="Custom intro example — Western Placer USD"
                    onOpen={() => setPreviewModal({ label: 'Custom intro example — Western Placer USD', url: 'https://wpusd.impacterpathway.com/f78d5omaf?preview' })}
                    height={200}
                  />
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
                  {/* Rotating report preview — matches home-page insight panel style */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#4a6fa5' }}>Sample disaggregated report insights</p>
                      <div className="flex items-center gap-1.5">
                        {/* Prev / Next arrows */}
                        {[
                          { dir: -1, path: 'M10 6L6 10l4 4' },
                          { dir:  1, path: 'M6 6l4 4-4 4'  },
                        ].map(({ dir, path }) => (
                          <button key={dir} type="button"
                            onClick={() => setDemoPanel(p => (p + dir + 3) % 3)}
                            className="rounded-full flex items-center justify-center border transition-colors hover:border-[#4a6fa5]/40"
                            style={{ width: 22, height: 22, background: 'white', border: '1px solid #e2e8f0' }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d={path} stroke="#4a6fa5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        ))}
                        {/* Dots */}
                        <div className="flex items-center gap-1 ml-1">
                          {[0,1,2].map(i => (
                            <button key={i} type="button" onClick={() => setDemoPanel(i)}
                              className="rounded-full transition-all"
                              style={{ width: demoPanel === i ? 16 : 6, height: 6, background: demoPanel === i ? '#4a6fa5' : '#c8d9ef' }} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ background: '#1a2744', minHeight: 268 }}
                      onMouseEnter={() => setDemoPaused(true)}
                      onMouseLeave={() => setDemoPaused(false)}>

                      {/* Panel 0: Risk by Grade */}
                      {demoPanel === 0 && (
                        <div className="p-5 flex flex-col gap-4" style={{ minHeight: 268 }}>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Behavioral Health · Risk Patterns</p>
                            <h4 className="text-sm font-bold text-white leading-snug">Risk behaviors peak in 7th grade —<br/>nearly 2× higher than 8th.</h4>
                          </div>
                          <svg viewBox="0 0 260 155" className="w-full">
                            {/* Column headers */}
                            <text x="84" y="13" textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">Pattern</text>
                            {['6th','7th','8th'].map((g, ci) => (
                              <text key={g} x={115 + ci * 53} y="13" textAnchor="middle" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.45)">{g}</text>
                            ))}
                            {/* Data rows */}
                            {RISK_ROWS.map((row, ri) => {
                              const shortLabel: Record<string, string> = {
                                'Self-doubt language': 'Self-Doubt Lang.',
                                'Help-seeking absence': 'Low Help-Seeking',
                              };
                              const label = shortLabel[row.pattern] ?? row.pattern;
                              const ry = 30 + ri * 24;
                              return (
                                <g key={ri}>
                                  <text x="84" y={ry} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="rgba(255,255,255,0.6)">{label}</text>
                                  {[row.g6, row.g7, row.g8].map((v, ci) => {
                                    const intensity = v / 7.25;
                                    const cx = 89 + ci * 57;
                                    return (
                                      <g key={ci}>
                                        <rect x={cx} y={ry - 9} width={52} height={18} rx="3"
                                          fill={`rgba(74,111,165,${0.12 + intensity * 0.78})`} />
                                        <text x={cx + 26} y={ry} textAnchor="middle" dominantBaseline="middle"
                                          fontSize="9" fontWeight="700"
                                          fill={intensity > 0.55 ? '#fff' : 'rgba(255,255,255,0.6)'}>{v.toFixed(1)}%</text>
                                      </g>
                                    );
                                  })}
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      )}

                      {/* Panel 1: BH Domains by Gender */}
                      {demoPanel === 1 && (
                        <div className="p-5 flex flex-col gap-4" style={{ minHeight: 268 }}>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Behavioral Health · Domain Analysis</p>
                            <h4 className="text-sm font-bold text-white leading-snug">Girls outscore boys across<br/>all BH domains.</h4>
                            <div className="flex items-center gap-3 text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: '#4a6fa5' }}></span>Female</span>
                              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: 'rgba(255,255,255,0.2)' }}></span>Male</span>
                            </div>
                          </div>
                          <svg viewBox="0 0 260 155" className="w-full">
                            {BH_DOMAIN_DATA.map((d, i) => {
                              const maxW = 140;
                              const scaleW = (v: number) => (v / 800) * maxW;
                              const y = 16 + i * 27;
                              return (
                                <g key={d.domain}>
                                  <text x="90" y={y + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.5)">{d.domain}</text>
                                  <rect x="94" y={y - 11} width={scaleW(d.male)} height={14} rx="3" fill="rgba(255,255,255,0.12)" />
                                  <rect x="94" y={y - 11} width={scaleW(d.female)} height={7} rx="3" fill="#4a6fa5" />
                                  <text x={97 + scaleW(d.female)} y={y - 5} fontSize="9" fill="#7aa3cc" fontWeight="700">{d.female}</text>
                                  <text x={97 + scaleW(d.male)} y={y + 3} fontSize="9" fill="rgba(255,255,255,0.3)" fontWeight="600">{d.male}</text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      )}

                      {/* Panel 2: CS Pillars by School */}
                      {demoPanel === 2 && (() => {
                        const pillarXs = [48, 100, 152, 204];
                        const pillarLabels = ['Student\nSupport', 'Family\nEngage.', 'Collab.\nLeader.', 'Expanded\nLearning'];
                        const avgY = 80;
                        const schools = [
                          { name: 'Franklin',  color: '#4a7fc1', deltas: [+10, -6, +14, +5]  },
                          { name: 'Lincoln',   color: '#9a5ab0', deltas: [+13, +7, -4,  +2]  },
                          { name: 'Jefferson', color: '#cc6648', deltas: [-7, +11, +3,  -9]  },
                        ];
                        const dY = (d: number) => avgY - d * 2.2;
                        return (
                          <div className="p-5 flex flex-col gap-4" style={{ minHeight: 268 }}>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a6fa5' }}>Community Schools · Pillar Scores</p>
                              <h4 className="text-sm font-bold text-white leading-snug">Franklin leads in Collaborative Leadership —<br/>Jefferson stands out in Family Engagement.</h4>
                            </div>
                            <svg viewBox="0 0 260 155" className="w-full">
                              {/* Avg dashed line */}
                              <line x1={pillarXs[0] - 20} y1={avgY} x2={pillarXs[3] + 45} y2={avgY}
                                stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 2" />
                              <text x={pillarXs[0] - 22} y={avgY} textAnchor="end" fontSize="7.5" fill="rgba(255,255,255,0.3)" dominantBaseline="middle">avg</text>
                              {/* Vertical pillar guides */}
                              {pillarXs.map((x, i) => (
                                <line key={i} x1={x} y1={avgY - 42} x2={x} y2={avgY + 42}
                                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                              ))}
                              {/* School connecting lines */}
                              {schools.map(s => (
                                <polyline key={s.name}
                                  points={pillarXs.map((x, i) => `${x},${dY(s.deltas[i])}`).join(' ')}
                                  fill="none" stroke={s.color} strokeWidth="2" strokeOpacity="0.55" />
                              ))}
                              {/* Dots + delta labels + school name at right */}
                              {schools.map(s => (
                                <g key={s.name}>
                                  {pillarXs.map((x, i) => (
                                    <g key={i}>
                                      <circle cx={x} cy={dY(s.deltas[i])} r="4" fill={s.color} />
                                      <text x={x} y={dY(s.deltas[i]) - 7} textAnchor="middle" fontSize="7.5"
                                        fill={s.color} fontWeight="700">
                                        {s.deltas[i] > 0 ? `+${s.deltas[i]}` : s.deltas[i]}
                                      </text>
                                    </g>
                                  ))}
                                  <text x={pillarXs[3] + 10} y={dY(s.deltas[3])} fontSize="8.5"
                                    fill={s.color} dominantBaseline="middle" fontWeight="600">{s.name}</text>
                                </g>
                              ))}
                              {/* Pillar labels at bottom */}
                              {pillarLabels.map((label, i) => (
                                <g key={i}>
                                  {label.split('\n').map((line, li) => (
                                    <text key={li} x={pillarXs[i]} y={128 + li * 10} textAnchor="middle"
                                      fontSize="8" fill="rgba(255,255,255,0.35)">{line}</text>
                                  ))}
                                </g>
                              ))}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
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
                  <button disabled={!canAdvanceStep3} onClick={() => setStep(4)}
                    className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}>
                    Continue
                  </button>
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
                  <button disabled={!canAdvanceStep4} onClick={() => setStep(5)}
                    className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}>
                    Continue
                  </button>
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
                    const lang = csPreviewLang[key] ?? 'en';
                    const open = !!csPreviewOpen[key];

                    return (
                      <div key={key} className="border border-gray-200 rounded-2xl overflow-hidden">
                        {/* Section header */}
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                          <p className="text-sm font-semibold text-gray-800">{label}</p>
                        </div>

                        <div className="p-5 space-y-5">
                          {/* Embedded preview */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#4a6fa5' }}>Sample Question</p>
                            <VideoAskEmbed
                              url={lang === 'es' && preview.es ? preview.es : preview.en}
                              label={`${label} — ${lang === 'en' ? 'English' : 'Español'}`}
                              onOpen={() => setPreviewModal({ label: `${label} — ${lang === 'en' ? 'English' : 'Español'}`, url: lang === 'es' && preview.es ? preview.es : preview.en })}
                              height={260}
                            />
                            {preview.es && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setCsPreviewLang(p => ({ ...p, [key]: lang === 'en' ? 'es' : 'en' }))}
                                  className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                  {lang === 'en' ? 'Ver en español' : 'View in English'}
                                </button>
                              </div>
                            )}
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
                          {mode === 'custom' && ([1,2,3,4] as const).map(pillar => {
                            const qs = CS_QUESTIONS.filter(q => q.age === key && q.p === pillar);
                            const selected = csPicks[key]?.[pillar];
                            return (
                              <div key={pillar} className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                  Pillar {pillar} — {PILLARS[pillar]}
                                </p>
                                <div className="space-y-2">
                                  {qs.map(q => (
                                    <label key={q.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                      selected === q.id ? 'border-[#4a6fa5] bg-[#f0f5fb]' : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}>
                                      <input type="radio" name={`${key}-p${pillar}`} value={q.id}
                                        checked={selected === q.id}
                                        onChange={() => setCsPicks(p => ({
                                          ...p,
                                          [key]: { ...(p[key] ?? {}), [pillar]: q.id }
                                        }))}
                                        className="accent-[#4a6fa5] mt-0.5 shrink-0" />
                                      <span className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                        {q.text}
                                        {q.def && <span className="ml-2 text-[10px] font-medium bg-[#f0f5fb] border border-[#4a6fa5]/20 px-1.5 py-0.5 rounded-full" style={{ color: '#4a6fa5' }}>standard</span>}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-between pt-2">
                    <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                    <button
                      disabled={!canAdvanceCS()}
                      onClick={() => setStep(3)}
                      className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}
                    >
                      Continue
                    </button>
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
                      <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.grades}</p>
                      </div>
                      <div className="p-5 space-y-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#4a6fa5' }}>Sample Question</p>
                        <VideoAskEmbed
                          url={s.previewUrl}
                          label={s.name}
                          onOpen={() => setPreviewModal({ label: s.name, url: s.previewUrl })}
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
                    <button
                      disabled={!canAdvanceBH()}
                      onClick={() => setStep(3)}
                      className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}
                    >
                      Continue
                    </button>
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
                        <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                          <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.grades}</p>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#4a6fa5' }}>Sample Question</p>
                          <VideoAskEmbed
                            url={a.previewUrl}
                            label={a.name}
                            onOpen={() => setPreviewModal({ label: a.name, url: a.previewUrl })}
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
                              <div className="border-t border-gray-100 pt-4 space-y-3">
                                <div className="flex justify-between items-center">
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Choose your questions</p>
                                  <span className="text-xs text-gray-400">{picks.length}/3 selected</span>
                                </div>
                                {allQs.map(q => {
                                  const checked = picks.includes(q.id);
                                  const atMax = picks.length >= 3 && !checked;
                                  return (
                                    <label key={q.id} className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                                      checked ? 'border-[#4a6fa5] bg-[#f0f5fb] cursor-pointer'
                                        : atMax ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                        : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                                    }`}>
                                      <input type="checkbox" checked={checked} disabled={atMax}
                                        onChange={() => {
                                          const next = checked ? picks.filter(id => id !== q.id) : [...picks, q.id];
                                          setLpPicks(p => ({ ...p, [a.id]: next }));
                                        }}
                                        className="accent-[#4a6fa5] mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#4a6fa5' }}>{q.attribute}</p>
                                        <p className="text-sm text-gray-700 leading-relaxed">{q.prompt}</p>
                                        {q.def && <span className="mt-1 inline-block text-[10px] font-medium bg-[#f0f5fb] border border-[#4a6fa5]/20 px-1.5 py-0.5 rounded-full" style={{ color: '#4a6fa5' }}>standard</span>}
                                      </div>
                                    </label>
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
                                  <div className="space-y-4 border-t border-gray-100 pt-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Step 2 — Choose your prompts</p>
                                    {qGroups.length === 0 && (
                                      <p className="text-xs text-gray-400">No prompts available for these attributes at this grade level.</p>
                                    )}
                                    {qGroups.map(({ chipName, qs }) => (
                                      <div key={chipName}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#4a6fa5' }}>{chipName}</p>
                                        <div className="space-y-2">
                                          {qs.map(q => {
                                            const checked = qPicks.includes(q.id);
                                            const primaryChip = primaryChipForQ.get(q.id) ?? chipName;
                                            const isClaimedByOther = checked && primaryChip !== chipName;
                                            return (
                                              <label key={q.id} className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                                                isClaimedByOther
                                                  ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                                  : checked
                                                    ? 'border-[#4a6fa5] bg-[#f0f5fb] cursor-pointer'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                                              }`}>
                                                <input type="radio"
                                                  name={`lp-${a.id}-${chipName}`}
                                                  checked={checked} disabled={isClaimedByOther}
                                                  onChange={() => {
                                                    if (isClaimedByOther) return;
                                                    // one question per attribute chip: deselect any other question owned by the same chip
                                                    const next = [
                                                      ...qPicks.filter(id => (primaryChipForQ.get(id) ?? '') !== primaryChip),
                                                      q.id,
                                                    ];
                                                    setLpQPicks(p => ({ ...p, [a.id]: next }));
                                                  }}
                                                  className="accent-[#4a6fa5] mt-0.5 shrink-0" />
                                                <div>
                                                  <p className="text-sm text-gray-700 leading-relaxed">{q.prompt}</p>
                                                  <div className="mt-1 flex flex-wrap gap-1">
                                                    {q.def && <span className="inline-block text-[10px] font-medium bg-[#f0f5fb] border border-[#4a6fa5]/20 px-1.5 py-0.5 rounded-full" style={{ color: '#4a6fa5' }}>standard</span>}
                                                    {isClaimedByOther && (
                                                      <span className="inline-block text-[10px] font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full text-amber-700">
                                                        already selected for {primaryChip}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              </label>
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
                    <button
                      disabled={!canAdvanceLP()}
                      onClick={() => setStep(3)}
                      className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}
                    >
                      Continue
                    </button>
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
                    disabled={submitting}
                    onClick={submit}
                    className="text-white text-sm font-medium px-6 py-2.5 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90" style={{ background: '#4a6fa5' }}
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

      {/* ── What makes this different ────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #f4f7fc 0%, #eef3fb 100%)' }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: '#4a6fa5' }}>What makes this different</h2>
          <p className="font-bold leading-snug mb-4 text-gray-900" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.85rem)' }}>
            Surveys tell you what students select.
          </p>
          <p className="font-bold leading-snug mb-6" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.85rem)', color: '#e07b54' }}>
            We measure what they actually say.
          </p>
          <p className="text-base leading-relaxed text-gray-500 mb-10">
            IMPACTER captures open-ended, authentic language and scores it against rubric-defined competency levels — at scale. The result is decision-grade data on how respondents are actually experiencing your schools and demonstrating future-ready competencies.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['200–800', 'rubric-aligned score'],
              ['< 1 week', 'time to first insight'],
              ['0 PII needed', 'privacy-first by design'],
            ].map(([val, label]) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: '1px solid #e8edf5' }}>
                <p className="text-xl font-bold mb-1" style={{ color: '#1a2744' }}>{val}</p>
                <p className="text-xs leading-tight text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center" style={{ background: '#1a2744', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>© {new Date().getFullYear()} Impacter Pathway · Schools measure hard skills. We measure the rest.</p>
      </footer>
    </div>
  );
}
