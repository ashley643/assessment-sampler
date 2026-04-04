import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/auth';

// PUT /api/admin/bundles/bulk-color
// Updates accent_color, badge_bg, badge_text for all bundles sharing old_accent_color.
export async function PUT(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { old_accent_color, accent_color, badge_bg, badge_text } = await req.json();

  const { error } = await supabaseAdmin
    .from('bundles')
    .update({ accent_color, badge_bg, badge_text })
    .eq('accent_color', old_accent_color);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
