import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items: { id: string; sort_order: number }[] = await req.json();

  await Promise.all(
    items.map(({ id, sort_order }) =>
      supabaseAdmin.from('assessments').update({ sort_order }).eq('id', id),
    ),
  );

  return NextResponse.json({ ok: true });
}
