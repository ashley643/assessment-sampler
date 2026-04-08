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

// Each letter maps to first names + positive trait "last names" starting with that letter
const ALLITERATIVE_NAMES: Record<string, { first: string[]; trait: string[] }> = {
  A: { first: ['Aaron','Aaliyah','Abby','Ace','Ada','Aiden','Alex','Aliya','Alvin','Amy'], trait: ['Achiever','Adventurous','Amazing','Ambitious','Artistic','Attentive','Authentic','Awesome'] },
  B: { first: ['Bailey','Ben','Bianca','Blake','Bobby','Brandon','Brianna','Brooke','Bruno','Bryson'], trait: ['Balanced','Brave','Bright','Brilliant','Bubbly','Bold','Bouncy','Benevolent'] },
  C: { first: ['Caleb','Camila','Carlos','Carmen','Casey','Charlie','Chloe','Clara','Cole','Corey'], trait: ['Calm','Capable','Caring','Cheerful','Clever','Compassionate','Confident','Creative','Curious'] },
  D: { first: ['Dakota','Damian','Danika','Danny','Deja','Derek','Diana','Diego','Dominic','Dylan'], trait: ['Daring','Dedicated','Delightful','Determined','Devoted','Diligent','Dynamic','Driven'] },
  E: { first: ['Eddie','Elena','Eli','Elijah','Elisa','Ella','Emma','Eric','Ethan','Eva'], trait: ['Eager','Earnest','Empathetic','Energetic','Enthusiastic','Expressive','Extraordinary','Excellent'] },
  F: { first: ['Faith','Felix','Finn','Florence','Francisco','Frankie','Freddie','Freya','Fiona','Flynn'], trait: ['Fearless','Focused','Forthright','Friendly','Fulfilled','Fantastic','Flourishing','Forgiving'] },
  G: { first: ['Gabriela','Gage','Genesis','Gianna','Gideon','Grace','Grant','Grayson','Greta','Gio'], trait: ['Generous','Gentle','Gifted','Glowing','Gracious','Grateful','Grounded','Genuine'] },
  H: { first: ['Hannah','Harley','Harper','Harrison','Hayden','Hazel','Henry','Hope','Hudson','Hunter'], trait: ['Happy','Hardworking','Harmonious','Helpful','Honest','Hopeful','Humble','Heroic'] },
  I: { first: ['Ian','Ida','Imani','Indigo','Ines','Isaac','Isabella','Isaiah','Ivan','Ivy'], trait: ['Imaginative','Inclusive','Independent','Industrious','Innovative','Insightful','Inspired','Intuitive'] },
  J: { first: ['Jade','Jasmine','Javier','Jayden','Jenna','Jesse','Jordan','Joy','Julian','Juniper'], trait: ['Joyful','Jubilant','Just','Jovial','Judicious','Journeying','Jazzy','Justified'] },
  K: { first: ['Kai','Kamila','Karen','Keanu','Keisha','Kelly','Kennedy','Kevin','Kim','Kyle'], trait: ['Kind','Keen','Kindhearted','Knowledgeable','Kooky','Kickstarting','Kaleidoscopic','Kudos'] },
  L: { first: ['Lana','Laura','Lauren','Layla','Leo','Lexi','Liam','Lily','Logan','Lucas'], trait: ['Lively','Loyal','Luminous','Loving','Likable','Lighthearted','Leading','Legendary'] },
  M: { first: ['Maddox','Makayla','Marcus','Maria','Mason','Maya','Mia','Miles','Morgan','Myles'], trait: ['Magnificent','Mindful','Motivated','Marvelous','Meaningful','Mighty','Masterful','Magnetic'] },
  N: { first: ['Nadia','Nathan','Natalie','Nico','Nicole','Noel','Nora','Noah','Nova','Nyla'], trait: ['Natural','Nurturing','Noble','Notable','Nice','Nimble','Nifty','Noteworthy'] },
  O: { first: ['Obi','Ocean','Olivia','Omar','Ona','Orlando','Oscar','Owen','Odessa','Orion'], trait: ['Open','Optimistic','Original','Outstanding','Outgoing','Openhearted','Observant','Organic'] },
  P: { first: ['Paige','Parker','Patrick','Penelope','Peyton','Phoenix','Phoebe','Priya','Pierce','Paloma'], trait: ['Patient','Peaceful','Persistent','Playful','Positive','Powerful','Proactive','Proud'] },
  Q: { first: ['Quinn','Quincy','Queen','Quest','Quentin','Quinella'], trait: ['Quick','Qualified','Quality','Quirky','Questioning','Quintessential'] },
  R: { first: ['Rachel','Rafael','Ramon','Reagan','Reese','Ricardo','Riley','River','Robin','Ryan'], trait: ['Radiant','Reliable','Resilient','Resourceful','Respectful','Remarkable','Righteous','Rising'] },
  S: { first: ['Sadie','Sam','Sara','Savannah','Sebastian','Selena','Siena','Skylar','Sofia','Summer'], trait: ['Sincere','Smart','Spirited','Splendid','Stellar','Strong','Supportive','Steadfast'] },
  T: { first: ['Talia','Taylor','Theodore','Tia','Tobias','Tommy','Tori','Tristan','Tyra','Tyler'], trait: ['Talented','Thoughtful','Thriving','Tenacious','Trustworthy','Terrific','Transformative','True'] },
  U: { first: ['Uma','Unique','Uri','Ursula','Ulani','Umberto'], trait: ['Understanding','United','Upbeat','Uplifting','Unifying','Unstoppable'] },
  V: { first: ['Valencia','Valentina','Victor','Victoria','Vincent','Violet','Vivian','Vance'], trait: ['Vibrant','Victorious','Visionary','Vivid','Valuable','Versatile','Valiant','Virtuous'] },
  W: { first: ['Wade','Wesley','Willow','Winter','Wren','Wyatt','Whitney','Warren'], trait: ['Warm','Wise','Wonderful','Witty','Worthy','Welcoming','Wholesome','Winning'] },
  X: { first: ['Xander','Xavier','Xena','Xiomara','Xochi','Xavi'], trait: ['Xenial','Xtraordinary','Xceptional','Xcellent','Xpressive','Xploring'] },
  Y: { first: ['Yasmine','Yolanda','Yusuf','Yvonne','Yara','Yael'], trait: ['Youthful','Yearning','Yielding','Yes-minded','Yielding','Yummy'] },
  Z: { first: ['Zach','Zara','Zeke','Zelda','Zion','Zoey','Zola','Zuri'], trait: ['Zealous','Zestful','Zenful','Zippy','Zappy','Zingy','Zoned-in','Zeal'] },
};

function djb2(str: string, seed = 5381): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

// contactId: stable per-student ID across forms (raw.contact_id from VideoAsk)
// usedNames: pass the same Set for an entire import run to prevent repeats
function generateStudentName(
  contactId: string,
  usedNames: Set<string>,
): { firstName: string; lastName: string; email: string } {
  const letters = Object.keys(ALLITERATIVE_NAMES);
  const h1 = djb2(contactId);
  const h2 = djb2(contactId + '\x00');

  for (let attempt = 0; attempt < 2000; attempt++) {
    const letter = letters[(h1 + attempt * 11) % letters.length];
    const { first, trait } = ALLITERATIVE_NAMES[letter];
    const firstName = first[(h2 + attempt * 7) % first.length];
    const lastName  = trait[(h1 + h2 + attempt * 13) % trait.length];
    const key = `${firstName}|${lastName}`;
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return {
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.impacter.com`,
      };
    }
  }
  // Extreme fallback (>2000 students with same hash — essentially impossible)
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
};

export type RunResult =
  | { inserted: number; skipped: number; error?: never }
  | { updated: number; error?: never }
  | { wouldInsert: number; wouldSkip: number; totalStepsFetched: number; sample: Record<string, unknown>[]; error?: never }
  | { error: string };

// Core import logic — called by both POST handler and update-all route
export async function runImportCore(params: RunParams): Promise<RunResult> {
  const { formId, staticValues, columnMappings, dryRun, nodeRoles, updateExisting } = params;
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

  // 2. Get existing URLs to skip already-imported rows.
  //    Use cursor-based pagination (id > lastId) instead of OFFSET to avoid
  //    statement timeouts — high-offset queries are O(offset) on large tables.
  const importedUuids = new Set<string>();
  const SR_PAGE = 1000;
  let lastId = 0;
  while (true) {
    const { data: urlPage, error: urlErr } = await impacter
      .from('student_responses')
      .select('id, url')
      .not('url', 'is', null)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(SR_PAGE);

    if (urlErr) return { error: urlErr.message };

    const rows = (urlPage ?? []) as { id: number; url: string }[];
    for (const row of rows) {
      const uuid = extractUuid(row.url ?? '');
      if (uuid) importedUuids.add(uuid);
    }

    if (rows.length < SR_PAGE) break;
    lastId = rows[rows.length - 1].id;
  }

  // 3. Build rows to insert (or update)
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  const usedNames = new Set<string>(); // ensures no name repeats within this import run

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

        // Auto-generate alliterative name — seed from contact_id (stable across all forms for same student)
        if (!row.first_name && !row.last_name && !row.student_email) {
          const contactId = String(
            (interactionSteps[0]?.raw as Record<string, unknown> | undefined)?.contact_id
            ?? interactionId
          );
          const { firstName, lastName, email } = generateStudentName(contactId, usedNames);
          row.first_name = firstName;
          row.last_name = lastName;
          row.student_email = email;
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

      // Auto-generate alliterative name — seed from contact_id (stable across all forms for same student)
      if (!row.first_name && !row.last_name && !row.student_email) {
        const contactId = String(
          (step.raw as Record<string, unknown> | undefined)?.contact_id
          ?? step.interaction_id
          ?? step.id
          ?? ''
        );
        const { firstName, lastName, email } = generateStudentName(contactId, usedNames);
        row.first_name = firstName;
        row.last_name = lastName;
        row.student_email = email;
      }

      toInsert.push(row);
    }
  }

  if (dryRun) {
    return { wouldInsert: toInsert.length, wouldSkip: skipped, totalStepsFetched: steps.length, sample: toInsert.slice(0, 3) };
  }

  // 4a. UPDATE existing rows (patch by url)
  if (updateExisting) {
    let updated = 0;
    const BATCH = 20;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const results = await Promise.all(
        toInsert.slice(i, i + BATCH).map(row => {
          const url = String(row.url ?? '');
          if (!url) return Promise.resolve({ error: null });
          return impacter.from('student_responses').update(row).eq('url', url);
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
