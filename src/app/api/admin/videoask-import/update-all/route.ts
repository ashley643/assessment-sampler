import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runImportCore } from '../run/route';

const SYSTEM_KEYS = new Set(['__discover_cache__']);

// POST /api/admin/videoask-import/update-all
// Runs "update existing" for every form that has a saved config.
// Streams newline-delimited JSON progress events.
export async function POST() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: configs, error } = await db
    .from('videoask_import_configs')
    .select('form_title, column_mappings, static_values')
    .order('form_title');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formConfigs = (configs ?? []).filter(c => !SYSTEM_KEYS.has(c.form_title));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      send({ type: 'start', total: formConfigs.length });

      let totalUpdated = 0;
      let totalErrors = 0;

      for (let i = 0; i < formConfigs.length; i++) {
        const cfg = formConfigs[i];
        const formId = cfg.form_title;
        const rawMappings = (cfg.column_mappings ?? {}) as Record<string, unknown>;
        const { __nodeRoles, ...columnMappings } = rawMappings;
        const staticValues = (cfg.static_values ?? {}) as Record<string, string>;
        const nodeRoles = __nodeRoles as Record<string, unknown> | undefined;

        send({ type: 'progress', index: i, total: formConfigs.length, formId });

        const result = await runImportCore({
          formId,
          columnMappings: columnMappings as Record<string, string>,
          staticValues,
          nodeRoles: nodeRoles as never,
          updateExisting: true,
        });

        if ('error' in result) {
          totalErrors++;
          send({ type: 'form_done', formId, error: result.error });
        } else if ('updated' in result) {
          totalUpdated += result.updated;
          send({ type: 'form_done', formId, updated: result.updated });
        }
      }

      send({ type: 'done', totalUpdated, totalErrors, total: formConfigs.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
