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
  'Elementary School': { en:'https://flex.impacterpathway.com/f5cn3e7bq#contact_email=X%2540XXXX.com&unit_id=XXXX', es:'https://flex.impacterpathway.com/fjoewj96b#contact_email=X%2540XXXX.com&unit_id=XXXX' },
  'Middle School':     { en:'https://flex.impacterpathway.com/fe2p81t9k#contact_email=X%2540XXXX.com&unit_id=XXXX', es:'https://flex.impacterpathway.com/fyzb1fx9j#contact_email=X%2540XXXX.com&unit_id=XXXX' },
  'High School':       { en:'https://flex.impacterpathway.com/fiwwhvwwa#contact_email=X%2540XXXX.com&unit_id=XXXX', es:'https://flex.impacterpathway.com/ftgvxd65q#contact_email=X%2540XXXX.com&unit_id=XXXX' },
  'Parent':            { en:'https://flex.impacterpathway.com/fe2byes29', es:'https://flex.impacterpathway.com/fhd7evhlp' },
  'Staff':             { en:'https://flex.impacterpathway.com/fad677c4k', es:null },
};

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
  languages: string[];
  otherLanguage: string;
  modalities: string[];
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
  languages: ['English'],
  otherLanguage: '',
  modalities: [],
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
      setStep(7);
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
    && !!form.launchTimeline
    && form.languages.length > 0
    && (!form.languages.includes('Other') || !!form.otherLanguage)
    && form.modalities.length > 0;
  const canAdvanceContact = !!form.name && !!form.email && !!form.organization;

  // CS helpers
  const isCS = form.assessmentType === 'community-schools';

  function getCsSections(): Array<{ key: AgeGroup; label: string }> {
    const out: Array<{ key: AgeGroup; label: string }> = [];
    const gl = form.gradeLevels;
    if (gl.includes('Lower Elementary (TK–2)') || gl.includes('Elementary (3rd–5th)'))
      out.push({ key: 'Elementary School', label: 'Elementary School' });
    if (gl.includes('Middle School (6th–8th)'))  out.push({ key: 'Middle School',    label: 'Middle School' });
    if (gl.includes('High School (9th–12th)'))   out.push({ key: 'High School',      label: 'High School' });
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

  // Step navigation (CS has an extra questions step at 4)
  type S = 1|2|3|4|5|6|7;
  function nextStep(cur: number): S {
    if (cur === 3) return (isCS ? 4 : 5) as S;
    if (cur === 4) return 5;
    return (cur + 1) as S;
  }
  function prevStep(cur: number): S {
    if (cur === 5) return (isCS ? 4 : 3) as S;
    if (cur === 4) return 3;
    return (cur - 1) as S;
  }

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
            {step < 7 && (() => {
              const steps = isCS
                ? [{n:1,l:'Assessment'},{n:2,l:'Dates'},{n:3,l:'Participants'},{n:4,l:'Questions'},{n:5,l:'Contact'}]
                : [{n:1,l:'Assessment'},{n:2,l:'Dates'},{n:3,l:'Participants'},{n:5,l:'Contact'}];
              const displayStep = (s: number) => isCS ? s : s > 3 ? s - 1 : s;
              return (
                <div className="flex items-center gap-1.5 mb-8">
                  {steps.map(({ n, l }, i) => (
                    <div key={n} className="flex items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        step === n ? 'bg-indigo-600 text-white' :
                        step > n  ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'
                      }`}>{displayStep(n)}</div>
                      <span className={`text-xs hidden sm:inline ${step === n ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{l}</span>
                      {i < steps.length - 1 && <div className={`h-px w-5 mx-1 transition-colors ${step > n ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
                    </div>
                  ))}
                </div>
              );
            })()}

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
                            checked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                  {form.languages.includes('Other') && (
                    <input
                      className={INPUT_CLS + ' mt-2'}
                      placeholder="Which language?"
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
                            checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
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
                              className="accent-indigo-600 w-4 h-4"
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

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <button
                    disabled={!canAdvanceStep3}
                    onClick={() => setStep(nextStep(3))}
                    className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: CS Question selector ──────────────────── */}
            {step === 4 && isCS && (() => {
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
                          {/* Preview toggle */}
                          <div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setCsPreviewOpen(p => ({ ...p, [key]: !open }))}
                                className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
                              >
                                {open ? 'Hide preview' : 'Preview standard assessment'}
                              </button>
                              {preview.es && open && (
                                <button
                                  type="button"
                                  onClick={() => setCsPreviewLang(p => ({ ...p, [key]: lang === 'en' ? 'es' : 'en' }))}
                                  className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                  {lang === 'en' ? 'Ver en español' : 'View in English'}
                                </button>
                              )}
                            </div>
                            {open && (
                              <div className="mt-3 rounded-xl overflow-hidden border border-gray-200" style={{ height: 420 }}>
                                <iframe
                                  src={lang === 'es' && preview.es ? preview.es : preview.en}
                                  className="w-full h-full border-0"
                                  allow="camera; microphone; autoplay"
                                  title={`${label} preview`}
                                />
                              </div>
                            )}
                          </div>

                          {/* Mode selector */}
                          <div className="space-y-2">
                            {([
                              { v: 'standard'  as const, l: 'Use the standard assessment' },
                              { v: 'custom'    as const, l: 'Customize — select one question per pillar' },
                              { v: 'write-own' as const, l: 'I\'d like to write custom questions' },
                            ]).map(({ v, l }) => (
                              <label key={v} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                mode === v ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}>
                                <input type="radio" name={`mode-${key}`} value={v} checked={mode === v}
                                  onChange={() => setCsMode(m => ({ ...m, [key]: v }))}
                                  className="accent-indigo-600" />
                                <span className="text-sm text-gray-700">{l}</span>
                              </label>
                            ))}
                          </div>

                          {/* Custom question selector */}
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
                                      selected === q.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}>
                                      <input type="radio" name={`${key}-p${pillar}`} value={q.id}
                                        checked={selected === q.id}
                                        onChange={() => setCsPicks(p => ({
                                          ...p,
                                          [key]: { ...(p[key] ?? {}), [pillar]: q.id }
                                        }))}
                                        className="accent-indigo-600 mt-0.5 shrink-0" />
                                      <span className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                        {q.text}
                                        {q.def && <span className="ml-2 text-[10px] font-medium text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">standard</span>}
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
                    <button onClick={() => setStep(prevStep(4))} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                    <button
                      disabled={!canAdvanceCS()}
                      onClick={() => setStep(nextStep(4))}
                      className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
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
                  <button onClick={() => setStep(prevStep(5))} className="text-sm text-gray-400 hover:text-gray-600">Back</button>
                  <button
                    disabled={!canAdvanceContact || submitting}
                    onClick={submit}
                    className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 7: Confirmation ───────────────────────────── */}
            {step === 7 && (
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
