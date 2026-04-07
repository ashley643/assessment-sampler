import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
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

// ── Deterministic fun student name generation ──────────────────────────────

const MALE_FIRST_NAMES = [
  'Carlos', 'Marcus', 'Jaylen', 'Theo', 'Amir', 'Eli', 'Noah', 'Zion',
  'Kofi', 'Miles', 'Leo', 'Darius', 'Andre', 'Kai', 'Omar', 'Micah',
  'Rohan', 'Dante', 'Felix', 'Nico',
];
const FEMALE_FIRST_NAMES = [
  'Mila', 'Sofia', 'Amara', 'Luna', 'Jade', 'Zara', 'Maya', 'Nia',
  'Aria', 'Iris', 'Vera', 'Rosa', 'Nova', 'Eden', 'Lyra', 'Celeste',
  'Imani', 'Adaeze', 'Paloma', 'Cleo',
];
const NEUTRAL_FIRST_NAMES = [
  'Jordan', 'Sage', 'River', 'Phoenix', 'Indigo', 'Rowan', 'Quinn', 'Alex',
  'Blake', 'Riley', 'Avery', 'Dakota', 'Finley', 'Morgan', 'Reese', 'Skylar',
  'Taylor', 'Cameron', 'Jamie', 'Casey',
];
const FUN_LAST_NAMES = [
  'Marvelous', 'Brilliant', 'Radiant', 'Stellar', 'Champion', 'Dazzling',
  'Fearless', 'Glorious', 'Heroic', 'Inspired', 'Joyful', 'Luminous',
  'Mighty', 'Notable', 'Outstanding', 'Profound', 'Remarkable', 'Splendid',
  'Triumphant', 'Valiant', 'Wonderful', 'Excellent', 'Awesome', 'Bold',
  'Cosmic', 'Dynamic', 'Vibrant', 'Radiant', 'Spirited', 'Unstoppable',
];

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function generateStudentName(interactionId: string, gender?: string | null): {
  firstName: string; lastName: string; email: string;
} {
  const h1 = djb2Hash(interactionId);
  const h2 = djb2Hash(interactionId + '_last');

  let firstNames: string[];
  const g = (gender ?? '').toLowerCase();
  if (g === 'male' || g === 'm' || g === 'boy') {
    firstNames = MALE_FIRST_NAMES;
  } else if (g === 'female' || g === 'f' || g === 'girl' || g === 'woman' || g === 'woman') {
    firstNames = FEMALE_FIRST_NAMES;
  } else {
    firstNames = NEUTRAL_FIRST_NAMES;
  }

  const firstName = firstNames[h1 % firstNames.length];
  const lastName = FUN_LAST_NAMES[h2 % FUN_LAST_NAMES.length];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.impacter.com`;
  return { firstName, lastName, email };
}

// ── Types ──────────────────────────────────────────────────────────────────

type NodeRole =
  | { role: 'response'; harvardAttribute?: string; caselAttribute?: string }
  | { role: 'metadata'; targetColumn: string; sourceField: 'transcript' | 'poll_option' }
  | { role: 'skip' };

type NodeRoles = Record<string, NodeRole>; // keyed by node_id

// POST /api/admin/videoask-import/run
// Applies column mappings + static values to videoask.steps rows
// and inserts them into student_responses, skipping already-imported ones.
// Pass dryRun: true to preview without writing.
// Pass nodeRoles to enable grouped import with metadata extraction.
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId, staticValues, columnMappings, dryRun, nodeRoles, updateExisting } = await req.json() as {
    formId: string;
    staticValues: Record<string, string>;
    columnMappings: Record<string, string>;
    dryRun?: boolean;
    nodeRoles?: NodeRoles;
    updateExisting?: boolean;
  };

  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // 1. Fetch all steps for this form (only columns we actually use)
  const { data: stepsData, error: stepsErr } = await impacter
    .schema('videoask')
    .from('steps')
    .select('id, interaction_id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
    .eq('form_id', formId);

  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  const steps = (stepsData ?? []) as Record<string, unknown>[];

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

    if (urlErr) return NextResponse.json({ error: urlErr.message }, { status: 500 });

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

        // Auto-generate fun anonymized student name per interaction (if not already mapped)
        if (!row.first_name && !row.last_name && !row.student_email) {
          const gender = typeof metadataValues.gender === 'string' ? metadataValues.gender : null;
          const { firstName, lastName, email } = generateStudentName(interactionId, gender);
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

      // Auto-generate fun name per interaction_id in flat mode too
      if (!row.first_name && !row.last_name && !row.student_email) {
        const interactionId = String(step.interaction_id ?? step.id ?? '');
        const { firstName, lastName, email } = generateStudentName(interactionId, null);
        row.first_name = firstName;
        row.last_name = lastName;
        row.student_email = email;
      }

      toInsert.push(row);
    }
  }

  if (dryRun) {
    return NextResponse.json({
      wouldInsert: toInsert.length,
      wouldSkip: skipped,
      sample: toInsert.slice(0, 3),
    });
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
          return impacter
            .from('student_responses')
            .update(row)
            .eq('url', url);
        })
      );
      for (const { error } of results as { error: { message: string } | null }[]) {
        if (error) return NextResponse.json({ error: error.message, updatedSoFar: updated }, { status: 500 });
      }
      updated += Math.min(BATCH, toInsert.length - i);
    }
    return NextResponse.json({ updated });
  }

  // 4b. INSERT new rows in chunks
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error: insertErr } = await impacter
      .from('student_responses')
      .insert(chunk);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message, insertedSoFar: inserted }, { status: 500 });
    }
    inserted += chunk.length;
  }

  return NextResponse.json({ inserted, skipped });
}
