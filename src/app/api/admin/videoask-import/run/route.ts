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
]);

// POST /api/admin/videoask-import/run
// Applies column mappings + static values to videoask.steps rows
// and inserts them into student_responses, skipping already-imported ones.
// Pass dryRun: true to preview without writing.
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { formId, staticValues, columnMappings, dryRun } = await req.json() as {
    formId: string;
    staticValues: Record<string, string>;
    columnMappings: Record<string, string>;
    dryRun?: boolean;
  };

  if (!formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // 1. Fetch all steps for this form
  const { data: stepsData, error: stepsErr } = await impacter
    .schema('videoask')
    .from('steps')
    .select('*')
    .eq('form_id', formId);

  if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  const steps = (stepsData ?? []) as Record<string, unknown>[];

  // 2. Get existing URLs to skip already-imported rows
  const { data: existingUrls, error: urlErr } = await impacter
    .from('student_responses')
    .select('url')
    .not('url', 'is', null);

  if (urlErr) return NextResponse.json({ error: urlErr.message }, { status: 500 });

  const importedUuids = new Set<string>();
  for (const row of (existingUrls ?? []) as { url: string }[]) {
    const uuid = extractUuid(row.url ?? '');
    if (uuid) importedUuids.add(uuid);
  }

  // 3. Build rows to insert
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const step of steps) {
    // Skip if already imported
    const mediaUrl = String(step.media_url ?? '');
    const uuid = extractUuid(mediaUrl);
    if (uuid && importedUuids.has(uuid)) {
      skipped++;
      continue;
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

    toInsert.push(row);
  }

  if (dryRun) {
    return NextResponse.json({
      wouldInsert: toInsert.length,
      wouldSkip: skipped,
      sample: toInsert.slice(0, 3),
    });
  }

  // 4. Insert in chunks
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
