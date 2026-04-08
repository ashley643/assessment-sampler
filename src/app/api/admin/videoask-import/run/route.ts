import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// Map VideoAsk internal media_type values to readable response types
function normalizeResponseType(raw: string, url?: string): string {
  // No URL = typed/text response regardless of what VideoAsk says
  if (url !== undefined && url === '') return 'text';
  switch (raw.toLowerCase()) {
    case 'standard': {
      // Derive from URL extension: .mp3 = audio, .mp4 = video
      const lower = (url ?? '').toLowerCase();
      if (lower.includes('.mp3')) return 'audio';
      if (lower.includes('.mp4')) return 'video';
      return 'video'; // fallback
    }
    case 'audio':    return 'audio';
    case 'text':     return 'text';
    case 'poll':     return 'poll';
    case 'file':     return 'file';
    default:         return raw;
  }
}

// The valid student_responses columns we can populate
const SR_COLUMNS = new Set([
  'district_name', 'school_name', 'class_name', 'teacher_name',
  'current_grade', 'gender', 'hispanic', 'ell', 'frl', 'iep',
  'ethnicity', 'home_language', 'session_name', 'course_id',
  'response_type', 'question', 'answer', 'harvard_attribute',
  'harvard_score', 'casel_attribute', 'casel_score', 'url',
  'answer_date', 'source_id',
  'first_name', 'last_name', 'student_email',
]);

// ── Alliterative positive student name generation ─────────────────────────

// Each first name tagged: 'f' = female-coded, 'm' = male-coded, 'n' = neutral
type NameEntry = { name: string; g: 'f' | 'm' | 'n' };

const ALLITERATIVE_NAMES: Record<string, { first: NameEntry[]; trait: string[] }> = {
  A: { first: [
    {name:'Aaliyah',g:'f'},{name:'Abby',g:'f'},{name:'Ada',g:'f'},{name:'Aliya',g:'f'},{name:'Amy',g:'f'},{name:'Amara',g:'f'},{name:'Aurora',g:'f'},
    {name:'Aaron',g:'m'},{name:'Ace',g:'m'},{name:'Aiden',g:'m'},{name:'Alvin',g:'m'},{name:'Andre',g:'m'},
    {name:'Alex',g:'n'},{name:'Avery',g:'n'},{name:'Ash',g:'n'},
  ], trait: ['Achiever','Adventurous','Amazing','Ambitious','Artistic','Attentive','Authentic','Awesome','Adaptive','Assured'] },
  B: { first: [
    {name:'Bianca',g:'f'},{name:'Brianna',g:'f'},{name:'Brooke',g:'f'},{name:'Bella',g:'f'},{name:'Beatrice',g:'f'},
    {name:'Ben',g:'m'},{name:'Bobby',g:'m'},{name:'Brandon',g:'m'},{name:'Bruno',g:'m'},{name:'Bryson',g:'m'},{name:'Barrett',g:'m'},
    {name:'Bailey',g:'n'},{name:'Blake',g:'n'},{name:'Blair',g:'n'},
  ], trait: ['Balanced','Brave','Bright','Brilliant','Bubbly','Bold','Bouncy','Benevolent','Blossoming','Beaming'] },
  C: { first: [
    {name:'Camila',g:'f'},{name:'Carmen',g:'f'},{name:'Chloe',g:'f'},{name:'Clara',g:'f'},{name:'Cora',g:'f'},{name:'Celeste',g:'f'},
    {name:'Caleb',g:'m'},{name:'Carlos',g:'m'},{name:'Cole',g:'m'},{name:'Connor',g:'m'},{name:'Cruz',g:'m'},
    {name:'Casey',g:'n'},{name:'Charlie',g:'n'},{name:'Corey',g:'n'},
  ], trait: ['Calm','Capable','Caring','Cheerful','Clever','Compassionate','Confident','Creative','Curious','Courageous'] },
  D: { first: [
    {name:'Danika',g:'f'},{name:'Deja',g:'f'},{name:'Diana',g:'f'},{name:'Dahlia',g:'f'},{name:'Destiny',g:'f'},
    {name:'Damian',g:'m'},{name:'Danny',g:'m'},{name:'Derek',g:'m'},{name:'Diego',g:'m'},{name:'Dominic',g:'m'},{name:'Damon',g:'m'},
    {name:'Dakota',g:'n'},{name:'Dylan',g:'n'},{name:'Drew',g:'n'},
  ], trait: ['Daring','Dedicated','Delightful','Determined','Devoted','Diligent','Dynamic','Driven','Dazzling','Dependable'] },
  E: { first: [
    {name:'Elena',g:'f'},{name:'Elisa',g:'f'},{name:'Ella',g:'f'},{name:'Emma',g:'f'},{name:'Eva',g:'f'},{name:'Esme',g:'f'},
    {name:'Eddie',g:'m'},{name:'Eli',g:'m'},{name:'Elijah',g:'m'},{name:'Eric',g:'m'},{name:'Ethan',g:'m'},{name:'Emilio',g:'m'},
    {name:'Emery',g:'n'},{name:'Elliot',g:'n'},
  ], trait: ['Eager','Earnest','Empathetic','Energetic','Enthusiastic','Expressive','Extraordinary','Excellent','Evolving','Enduring'] },
  F: { first: [
    {name:'Faith',g:'f'},{name:'Florence',g:'f'},{name:'Freya',g:'f'},{name:'Fiona',g:'f'},{name:'Felicity',g:'f'},
    {name:'Felix',g:'m'},{name:'Finn',g:'m'},{name:'Francisco',g:'m'},{name:'Freddie',g:'m'},{name:'Flynn',g:'m'},
    {name:'Frankie',g:'n'},{name:'Finley',g:'n'},
  ], trait: ['Fearless','Focused','Forthright','Friendly','Fulfilled','Fantastic','Flourishing','Forgiving','Forward','Fierce'] },
  G: { first: [
    {name:'Gabriela',g:'f'},{name:'Gianna',g:'f'},{name:'Grace',g:'f'},{name:'Greta',g:'f'},{name:'Gloria',g:'f'},
    {name:'Gage',g:'m'},{name:'Gideon',g:'m'},{name:'Grant',g:'m'},{name:'Grayson',g:'m'},{name:'Garrett',g:'m'},
    {name:'Genesis',g:'n'},{name:'Gio',g:'n'},
  ], trait: ['Generous','Gentle','Gifted','Glowing','Gracious','Grateful','Grounded','Genuine','Growing','Gleaming'] },
  H: { first: [
    {name:'Hannah',g:'f'},{name:'Hazel',g:'f'},{name:'Hope',g:'f'},{name:'Holly',g:'f'},{name:'Hana',g:'f'},
    {name:'Harrison',g:'m'},{name:'Henry',g:'m'},{name:'Hudson',g:'m'},{name:'Hugo',g:'m'},{name:'Hector',g:'m'},
    {name:'Harley',g:'n'},{name:'Harper',g:'n'},{name:'Hayden',g:'n'},{name:'Hunter',g:'n'},
  ], trait: ['Happy','Hardworking','Harmonious','Helpful','Honest','Hopeful','Humble','Heroic','Heartfelt','Healing'] },
  I: { first: [
    {name:'Ida',g:'f'},{name:'Ines',g:'f'},{name:'Isabella',g:'f'},{name:'Ivy',g:'f'},{name:'Iris',g:'f'},
    {name:'Ian',g:'m'},{name:'Isaac',g:'m'},{name:'Isaiah',g:'m'},{name:'Ivan',g:'m'},{name:'Ignacio',g:'m'},
    {name:'Imani',g:'n'},{name:'Indigo',g:'n'},
  ], trait: ['Imaginative','Inclusive','Independent','Industrious','Innovative','Insightful','Inspired','Intuitive','Impactful','Inquisitive'] },
  J: { first: [
    {name:'Jade',g:'f'},{name:'Jasmine',g:'f'},{name:'Jenna',g:'f'},{name:'Joy',g:'f'},{name:'Juniper',g:'f'},{name:'Julia',g:'f'},
    {name:'Javier',g:'m'},{name:'Jayden',g:'m'},{name:'Julian',g:'m'},{name:'Jonas',g:'m'},{name:'Joel',g:'m'},
    {name:'Jesse',g:'n'},{name:'Jordan',g:'n'},{name:'Jamie',g:'n'},
  ], trait: ['Joyful','Jubilant','Just','Jovial','Judicious','Journeying','Jazzy','Justified','Joyous','Jumping'] },
  K: { first: [
    {name:'Kamila',g:'f'},{name:'Karen',g:'f'},{name:'Keisha',g:'f'},{name:'Kira',g:'f'},{name:'Kylie',g:'f'},
    {name:'Keanu',g:'m'},{name:'Kevin',g:'m'},{name:'Kyle',g:'m'},{name:'Kane',g:'m'},{name:'Knox',g:'m'},
    {name:'Kai',g:'n'},{name:'Kelly',g:'n'},{name:'Kennedy',g:'n'},{name:'Kim',g:'n'},
  ], trait: ['Kind','Keen','Kindhearted','Knowledgeable','Kickstarting','Kaleidoscopic','Kudos','Kicking','Kindling','Knowing'] },
  L: { first: [
    {name:'Lana',g:'f'},{name:'Laura',g:'f'},{name:'Lauren',g:'f'},{name:'Layla',g:'f'},{name:'Lexi',g:'f'},{name:'Lily',g:'f'},{name:'Luna',g:'f'},
    {name:'Leo',g:'m'},{name:'Liam',g:'m'},{name:'Lucas',g:'m'},{name:'Luca',g:'m'},{name:'Lance',g:'m'},
    {name:'Logan',g:'n'},{name:'Lennon',g:'n'},
  ], trait: ['Lively','Loyal','Luminous','Loving','Likable','Lighthearted','Leading','Legendary','Limitless','Lifting'] },
  M: { first: [
    {name:'Makayla',g:'f'},{name:'Maria',g:'f'},{name:'Maya',g:'f'},{name:'Mia',g:'f'},{name:'Mikaela',g:'f'},{name:'Melody',g:'f'},
    {name:'Maddox',g:'m'},{name:'Marcus',g:'m'},{name:'Mason',g:'m'},{name:'Miles',g:'m'},{name:'Myles',g:'m'},{name:'Miguel',g:'m'},
    {name:'Morgan',g:'n'},{name:'Micah',g:'n'},
  ], trait: ['Magnificent','Mindful','Motivated','Marvelous','Meaningful','Mighty','Masterful','Magnetic','Maturing','Mentoring'] },
  N: { first: [
    {name:'Nadia',g:'f'},{name:'Natalie',g:'f'},{name:'Nicole',g:'f'},{name:'Nora',g:'f'},{name:'Nova',g:'f'},{name:'Nyla',g:'f'},
    {name:'Nathan',g:'m'},{name:'Noah',g:'m'},{name:'Nico',g:'m'},{name:'Noel',g:'m'},{name:'Niko',g:'m'},
    {name:'Naveen',g:'n'},
  ], trait: ['Natural','Nurturing','Noble','Notable','Nice','Nimble','Nifty','Noteworthy','Nourishing','Navigating'] },
  O: { first: [
    {name:'Olivia',g:'f'},{name:'Ona',g:'f'},{name:'Odessa',g:'f'},{name:'Opal',g:'f'},
    {name:'Obi',g:'m'},{name:'Omar',g:'m'},{name:'Orlando',g:'m'},{name:'Oscar',g:'m'},{name:'Owen',g:'m'},{name:'Orion',g:'m'},
    {name:'Ocean',g:'n'},
  ], trait: ['Open','Optimistic','Original','Outstanding','Outgoing','Openhearted','Observant','Organic','Overcoming','Owning'] },
  P: { first: [
    {name:'Paige',g:'f'},{name:'Penelope',g:'f'},{name:'Phoebe',g:'f'},{name:'Priya',g:'f'},{name:'Paloma',g:'f'},{name:'Pia',g:'f'},
    {name:'Patrick',g:'m'},{name:'Pierce',g:'m'},{name:'Pablo',g:'m'},{name:'Preston',g:'m'},
    {name:'Parker',g:'n'},{name:'Peyton',g:'n'},{name:'Phoenix',g:'n'},
  ], trait: ['Patient','Peaceful','Persistent','Playful','Positive','Powerful','Proactive','Proud','Purpose-driven','Promising'] },
  Q: { first: [
    {name:'Queen',g:'f'},{name:'Quinella',g:'f'},
    {name:'Quincy',g:'m'},{name:'Quentin',g:'m'},{name:'Quest',g:'m'},
    {name:'Quinn',g:'n'},
  ], trait: ['Quick','Qualified','Quality','Quirky','Questioning','Quintessential','Questing','Quiet-strength'] },
  R: { first: [
    {name:'Rachel',g:'f'},{name:'Rosa',g:'f'},{name:'Rosalind',g:'f'},{name:'Ruby',g:'f'},
    {name:'Rafael',g:'m'},{name:'Ramon',g:'m'},{name:'Ricardo',g:'m'},{name:'Roman',g:'m'},{name:'Ryder',g:'m'},
    {name:'Reagan',g:'n'},{name:'Reese',g:'n'},{name:'Riley',g:'n'},{name:'River',g:'n'},{name:'Robin',g:'n'},{name:'Ryan',g:'n'},
  ], trait: ['Radiant','Reliable','Resilient','Resourceful','Respectful','Remarkable','Righteous','Rising','Reaching','Rooted'] },
  S: { first: [
    {name:'Sadie',g:'f'},{name:'Sara',g:'f'},{name:'Savannah',g:'f'},{name:'Selena',g:'f'},{name:'Siena',g:'f'},{name:'Sofia',g:'f'},{name:'Summer',g:'f'},{name:'Stella',g:'f'},
    {name:'Sebastian',g:'m'},{name:'Sergio',g:'m'},{name:'Simon',g:'m'},{name:'Sterling',g:'m'},
    {name:'Sam',g:'n'},{name:'Skylar',g:'n'},{name:'Sage',g:'n'},
  ], trait: ['Sincere','Smart','Spirited','Splendid','Stellar','Strong','Supportive','Steadfast','Shining','Soaring'] },
  T: { first: [
    {name:'Talia',g:'f'},{name:'Tia',g:'f'},{name:'Tori',g:'f'},{name:'Tyra',g:'f'},{name:'Thea',g:'f'},
    {name:'Theodore',g:'m'},{name:'Tobias',g:'m'},{name:'Tommy',g:'m'},{name:'Tristan',g:'m'},{name:'Tyler',g:'m'},{name:'Tanner',g:'m'},
    {name:'Taylor',g:'n'},{name:'Tatum',g:'n'},
  ], trait: ['Talented','Thoughtful','Thriving','Tenacious','Trustworthy','Terrific','Transformative','True','Trailblazing','Touching'] },
  U: { first: [
    {name:'Uma',g:'f'},{name:'Ursula',g:'f'},{name:'Ulani',g:'f'},
    {name:'Uri',g:'m'},{name:'Umberto',g:'m'},{name:'Upton',g:'m'},
    {name:'Unique',g:'n'},
  ], trait: ['Understanding','United','Upbeat','Uplifting','Unifying','Unstoppable','Unwavering','Upstanding'] },
  V: { first: [
    {name:'Valencia',g:'f'},{name:'Valentina',g:'f'},{name:'Victoria',g:'f'},{name:'Violet',g:'f'},{name:'Vivian',g:'f'},
    {name:'Victor',g:'m'},{name:'Vincent',g:'m'},{name:'Vance',g:'m'},{name:'Vito',g:'m'},
    {name:'Val',g:'n'},
  ], trait: ['Vibrant','Victorious','Visionary','Vivid','Valuable','Versatile','Valiant','Virtuous','Venturing','Vital'] },
  W: { first: [
    {name:'Willow',g:'f'},{name:'Whitney',g:'f'},{name:'Willa',g:'f'},
    {name:'Wade',g:'m'},{name:'Wesley',g:'m'},{name:'Wyatt',g:'m'},{name:'Warren',g:'m'},{name:'Winston',g:'m'},
    {name:'Winter',g:'n'},{name:'Wren',g:'n'},
  ], trait: ['Warm','Wise','Wonderful','Witty','Worthy','Welcoming','Wholesome','Winning','Willing','Wide-open'] },
  X: { first: [
    {name:'Xena',g:'f'},{name:'Xiomara',g:'f'},{name:'Xochi',g:'f'},
    {name:'Xander',g:'m'},{name:'Xavier',g:'m'},{name:'Xavi',g:'m'},
  ], trait: ['Xenial','Xtraordinary','Xceptional','Xcellent','Xpressive','Xploring'] },
  Y: { first: [
    {name:'Yasmine',g:'f'},{name:'Yolanda',g:'f'},{name:'Yvonne',g:'f'},{name:'Yara',g:'f'},
    {name:'Yusuf',g:'m'},{name:'Yogi',g:'m'},
    {name:'Yael',g:'n'},
  ], trait: ['Youthful','Yearning','Yes-minded','Yielding','Yummy','Yielding'] },
  Z: { first: [
    {name:'Zara',g:'f'},{name:'Zelda',g:'f'},{name:'Zoey',g:'f'},{name:'Zola',g:'f'},{name:'Zuri',g:'f'},
    {name:'Zach',g:'m'},{name:'Zeke',g:'m'},{name:'Zion',g:'m'},{name:'Zane',g:'m'},
    {name:'Zen',g:'n'},
  ], trait: ['Zealous','Zestful','Zenful','Zippy','Zappy','Zingy','Zoned-in','Zeal'] },
};

function djb2(str: string, seed = 5381): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

// contactId: stable per-student ID across forms (raw.contact_id from VideoAsk)
// usedFirstNames: first names already taken in this run + pre-seeded from DB
// gender: 'Female' | 'Male' | '' | null — used to pick gender-appropriate first names
function generateStudentName(
  contactId: string,
  usedFirstNames: Set<string>,
  gender: string | null,
): { firstName: string; lastName: string; email: string } {
  const g = (gender ?? '').toLowerCase();
  const isFemale = g.includes('female') || g === 'f';
  const isMale   = !isFemale && (g.includes('male') || g === 'm');

  const letters = Object.keys(ALLITERATIVE_NAMES);
  const h1 = djb2(contactId);
  const h2 = djb2(contactId + '\x00');

  for (let attempt = 0; attempt < 2000; attempt++) {
    const letter = letters[(h1 + attempt * 11) % letters.length];
    const { first, trait } = ALLITERATIVE_NAMES[letter];

    // Filter to gender-appropriate names; fall back to neutral, then all
    let pool = first.filter(e => isFemale ? e.g === 'f' : isMale ? e.g === 'm' : true);
    if (pool.length === 0) pool = first.filter(e => e.g === 'n');
    if (pool.length === 0) pool = first;

    const firstName = pool[(h2 + attempt * 7) % pool.length].name;
    if (usedFirstNames.has(firstName)) continue; // first name already taken

    const lastName  = trait[(h1 + h2 + attempt * 13) % trait.length];
    usedFirstNames.add(firstName);
    return {
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.impacter.com`,
    };
  }
  // Extreme fallback
  const fb = contactId.slice(0, 6);
  return { firstName: 'Student', lastName: fb, email: `student.${fb}@student.impacter.com` };
}


// ── Types ──────────────────────────────────────────────────────────────────

type NodeRole =
  | { role: 'response'; harvardAttribute?: string; caselAttribute?: string }
  | { role: 'metadata'; targetColumn: string; sourceField: 'transcript' | 'poll_option' }
  | { role: 'skip' };

type NodeRoles = Record<string, NodeRole>; // keyed by node_id

type RunParams = {
  formId: string;
  staticValues: Record<string, string>;
  columnMappings: Record<string, string>;
  dryRun?: boolean;
  nodeRoles?: NodeRoles;
  updateExisting?: boolean;
  regenNames?: boolean; // when true + updateExisting, ignore old DB names and regenerate fresh
};

export type RunResult =
  | { inserted: number; skipped: number; error?: never }
  | { updated: number; error?: never }
  | { wouldInsert: number; wouldSkip: number; totalStepsFetched: number; sample: Record<string, unknown>[]; error?: never }
  | { error: string };

// Core import logic — called by both POST handler and update-all route
export async function runImportCore(params: RunParams): Promise<RunResult> {
  const { formId, staticValues, columnMappings, dryRun, nodeRoles, updateExisting, regenNames } = params;
  if (!formId) return { error: 'formId required' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // 1. Fetch ALL steps for this form using cursor pagination (Supabase default cap = 1,000 rows)
  const steps: Record<string, unknown>[] = [];
  {
    const STEP_PAGE = 1000;
    let lastStepId = '00000000-0000-0000-0000-000000000000';
    while (true) {
      const { data: page, error: stepsErr } = await impacter
        .schema('videoask')
        .from('steps')
        .select('id, interaction_id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
        .eq('form_id', formId)
        .gt('id', lastStepId)
        .order('id', { ascending: true })
        .limit(STEP_PAGE);

      if (stepsErr) return { error: stepsErr.message };
      const rows = (page ?? []) as Record<string, unknown>[];
      steps.push(...rows);
      if (rows.length < STEP_PAGE) break;
      lastStepId = String(rows[rows.length - 1].id);
    }
  }

  // 1b. Build set of UUIDs from this form's steps — used to scope usedFirstNames to this form only.
  //     Pre-seeding from ALL districts would exhaust the name pool (~390 names) with large datasets.
  const formStepUuids = new Set<string>();
  for (const step of steps) {
    const uuid = extractUuid(String(step.media_url ?? ''));
    if (uuid) formStepUuids.add(uuid);
  }

  // 2. Get existing URLs to skip already-imported rows.
  //    Use cursor-based pagination (id > lastId) instead of OFFSET to avoid
  //    statement timeouts — high-offset queries are O(offset) on large tables.
  const importedUuids = new Set<string>();
  const uuidToId   = new Map<string, number>(); // uuid → student_responses.id for fast PK updates
  const uuidToName = new Map<string, { firstName: string; lastName: string; email: string }>(); // existing names
  const usedFirstNames = new Set<string>(); // first names taken within this form's rows + this run
  const SR_PAGE = 1000;
  let lastId = 0;
  while (true) {
    const { data: urlPage, error: urlErr } = await impacter
      .from('student_responses')
      .select('id, url, first_name, last_name, student_email')
      .not('url', 'is', null)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(SR_PAGE);

    if (urlErr) return { error: urlErr.message };

    const rows = (urlPage ?? []) as { id: number; url: string; first_name?: string; last_name?: string; student_email?: string }[];
    for (const row of rows) {
      const uuid = extractUuid(row.url ?? '');
      if (uuid) {
        importedUuids.add(uuid);
        uuidToId.set(uuid, row.id);
        if (row.first_name) {
          uuidToName.set(uuid, { firstName: row.first_name, lastName: row.last_name ?? '', email: row.student_email ?? '' });
          // Only seed usedFirstNames from rows that belong to THIS form — prevents
          // other districts from consuming name slots and causing "Student 6e2f76" fallbacks.
          if (formStepUuids.has(uuid)) {
            usedFirstNames.add(row.first_name);
          }
        }
      }
    }

    if (rows.length < SR_PAGE) break;
    lastId = rows[rows.length - 1].id;
  }

  // 3. Build rows to insert (or update)
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  // contactIdToName: within a single run, ensures the same contact_id always gets the same name
  // (relevant when a student has multiple response nodes — each is a separate row but same person)
  const contactIdToName = new Map<string, { firstName: string; lastName: string; email: string }>();

  const hasNodeRoles = nodeRoles && Object.keys(nodeRoles).length > 0;

  if (hasNodeRoles) {
    // ── NODE-ROLE MODE: group by interaction_id ──

    // Group steps by interaction_id
    const byInteraction = new Map<string, Record<string, unknown>[]>();
    for (const step of steps) {
      const interactionId = String(step.interaction_id ?? '');
      if (!byInteraction.has(interactionId)) byInteraction.set(interactionId, []);
      byInteraction.get(interactionId)!.push(step);
    }

    for (const [interactionId, interactionSteps] of byInteraction) {
      // a. Collect metadata values for this interaction
      const metadataValues: Record<string, unknown> = {};
      for (const step of interactionSteps) {
        const nodeId = String(step.node_id ?? '');
        const nodeRole = nodeRoles[nodeId];
        if (!nodeRole || nodeRole.role !== 'metadata') continue;
        const { targetColumn, sourceField } = nodeRole;
        if (!SR_COLUMNS.has(targetColumn)) continue;

        let value: unknown = null;
        if (sourceField === 'transcript') {
          value = step.transcript ?? null;
        } else if (sourceField === 'poll_option') {
          const raw = (step.raw ?? {}) as Record<string, unknown>;
          // VideoAsk stores the selected option directly in poll_option_content
          if (typeof raw.poll_option_content === 'string' && raw.poll_option_content) {
            value = raw.poll_option_content;
          } else {
            // Fallback: poll_options only contains the selected option, field is 'content' not 'label'
            const pollOptions = raw.poll_options as Array<{ content?: string; label?: string }> | undefined;
            value = pollOptions?.[0]?.content ?? pollOptions?.[0]?.label ?? null;
          }
        }

        if (value != null) {
          metadataValues[targetColumn] = value;
        }
      }

      // b. Build a row for each response-role step in this interaction
      for (const step of interactionSteps) {
        const nodeId = String(step.node_id ?? '');
        const nodeRole = nodeRoles[nodeId];
        if (!nodeRole || nodeRole.role !== 'response') continue;

        // UUID dedup check
        const mediaUrl = String(step.media_url ?? '');
        const uuid = extractUuid(mediaUrl);
        const alreadyImported = !!(uuid && importedUuids.has(uuid));
        if (updateExisting) {
          if (!alreadyImported || !mediaUrl) continue; // only rows that exist
        } else {
          if (alreadyImported) { skipped++; continue; } // skip already-imported
        }

        const row: Record<string, unknown> = {};

        // Apply static values first
        for (const [col, val] of Object.entries(staticValues ?? {})) {
          if (SR_COLUMNS.has(col)) row[col] = val;
        }

        // Apply column mappings
        for (const [srCol, stepCol] of Object.entries(columnMappings ?? {})) {
          if (!SR_COLUMNS.has(srCol) || !stepCol) continue;
          if (stepCol.startsWith('raw.')) {
            const rawKey = stepCol.slice(4);
            const raw = (step.raw ?? {}) as Record<string, unknown>;
            if (raw[rawKey] !== undefined && raw[rawKey] !== null) {
              row[srCol] = raw[rawKey];
            }
          } else if (step[stepCol] !== undefined && step[stepCol] !== null) {
            row[srCol] = step[stepCol];
          }
        }

        // Always ensure url is populated from media_url
        if (!row.url && mediaUrl) row.url = mediaUrl;

        // Normalize VideoAsk media_type → human-readable response_type
        if (row.response_type) row.response_type = normalizeResponseType(String(row.response_type), mediaUrl);

        // Overlay interaction metadata (only fills gaps — explicit mappings take precedence)
        for (const [col, val] of Object.entries(metadataValues)) {
          if (row[col] === undefined || row[col] === null || row[col] === '') {
            row[col] = val;
          }
        }

        // Apply per-node Harvard/CASEL attributes (only if not already set by mappings)
        if (nodeRole.harvardAttribute && !row.harvard_attribute) {
          row.harvard_attribute = nodeRole.harvardAttribute;
        }
        if (nodeRole.caselAttribute && !row.casel_attribute) {
          row.casel_attribute = nodeRole.caselAttribute;
        }

        // Auto-generate alliterative name — gender-aware, globally unique first name
        if (!row.first_name && !row.last_name && !row.student_email) {
          const contactId = String(
            (interactionSteps[0]?.raw as Record<string, unknown> | undefined)?.contact_id
            ?? interactionId
          );
          // 1. Already imported under a different question node → reuse same name
          //    (skipped when regenNames=true — forces fresh gender-aware generation)
          const existingByUrl = (!regenNames && uuid) ? uuidToName.get(uuid) : undefined;
          // 2. Same contact_id seen earlier in this run → reuse (always active, ensures same student = same name)
          const existingByContact = contactIdToName.get(contactId);
          // 3. Generate fresh
          const resolved = existingByUrl ?? existingByContact
            ?? generateStudentName(contactId, usedFirstNames, String(row.gender ?? metadataValues.gender ?? ''));
          if (!existingByContact) contactIdToName.set(contactId, resolved);
          row.first_name    = resolved.firstName;
          row.last_name     = resolved.lastName;
          row.student_email = resolved.email;
        }

        toInsert.push(row);
      }
    }
  } else {
    // ── FLAT MODE: one row per step (original logic) ──
    for (const step of steps) {
      const mediaUrl = String(step.media_url ?? '');
      const uuid = extractUuid(mediaUrl);
      const alreadyImported = !!(uuid && importedUuids.has(uuid));
      if (updateExisting) {
        if (!alreadyImported || !mediaUrl) continue;
      } else {
        if (alreadyImported) { skipped++; continue; }
      }

      const row: Record<string, unknown> = {};

      // Apply static values first
      for (const [col, val] of Object.entries(staticValues ?? {})) {
        if (SR_COLUMNS.has(col)) row[col] = val;
      }

      // Apply column mappings: srColumn → videoask step column (or raw sub-field)
      for (const [srCol, stepCol] of Object.entries(columnMappings ?? {})) {
        if (!SR_COLUMNS.has(srCol) || !stepCol) continue;

        // Support "raw.field_name" to pull from the raw JSONB
        if (stepCol.startsWith('raw.')) {
          const rawKey = stepCol.slice(4);
          const raw = (step.raw ?? {}) as Record<string, unknown>;
          if (raw[rawKey] !== undefined && raw[rawKey] !== null) {
            row[srCol] = raw[rawKey];
          }
        } else if (step[stepCol] !== undefined && step[stepCol] !== null) {
          row[srCol] = step[stepCol];
        }
      }

      // Always ensure url is populated from media_url
      if (!row.url && mediaUrl) row.url = mediaUrl;

      // Normalize VideoAsk media_type → human-readable response_type
      if (row.response_type) row.response_type = normalizeResponseType(String(row.response_type));

      // Auto-generate alliterative name — gender-aware, globally unique first name
      if (!row.first_name && !row.last_name && !row.student_email) {
        const contactId = String(
          (step.raw as Record<string, unknown> | undefined)?.contact_id
          ?? step.interaction_id
          ?? step.id
          ?? ''
        );
        const uuid = extractUuid(String(step.media_url ?? ''));
        const existingByUrl     = (!regenNames && uuid) ? uuidToName.get(uuid) : undefined;
        const existingByContact = contactIdToName.get(contactId);
        const resolved = existingByUrl ?? existingByContact
          ?? generateStudentName(contactId, usedFirstNames, String(row.gender ?? ''));
        if (!existingByContact) contactIdToName.set(contactId, resolved);
        row.first_name    = resolved.firstName;
        row.last_name     = resolved.lastName;
        row.student_email = resolved.email;
      }

      toInsert.push(row);
    }
  }

  if (dryRun) {
    return { wouldInsert: toInsert.length, wouldSkip: skipped, totalStepsFetched: steps.length, sample: toInsert.slice(0, 3) };
  }

  // 4a. UPDATE existing rows — match by primary key (id) to avoid full-table scan on url
  if (updateExisting) {
    let updated = 0;
    const BATCH = 20;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const results = await Promise.all(
        toInsert.slice(i, i + BATCH).map(row => {
          const uuid = extractUuid(String(row.url ?? ''));
          const rowId = uuid ? uuidToId.get(uuid) : undefined;
          if (!rowId) return Promise.resolve({ error: null });
          return impacter.from('student_responses').update(row).eq('id', rowId);
        })
      );
      for (const { error } of results as { error: { message: string } | null }[]) {
        if (error) return { error: error.message };
      }
      updated += Math.min(BATCH, toInsert.length - i);
    }
    return { updated };
  }

  // 4b. INSERT new rows in chunks
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error: insertErr } = await impacter.from('student_responses').insert(chunk);
    if (insertErr) return { error: insertErr.message };
    inserted += chunk.length;
  }

  return { inserted, skipped };
}

// POST /api/admin/videoask-import/run
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = await req.json() as RunParams;
  if (!params.formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const result = await runImportCore(params);
  return NextResponse.json(result, { status: 'error' in result ? 500 : 200 });
}
