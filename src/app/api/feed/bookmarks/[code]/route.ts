import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Params = { params: Promise<{ code: string }> };

// GET — return current bookmarks for a code
export async function GET(_: Request, { params }: Params) {
  const { code } = await params;
  const { data, error } = await supabaseAdmin
    .from('access_codes')
    .select('bookmarks')
    .eq('code', code.toUpperCase())
    .single();
  if (error || !data) return NextResponse.json({ bookmarks: [] });
  return NextResponse.json({ bookmarks: data.bookmarks ?? [] });
}

// PUT — replace the full bookmark list for a code
export async function PUT(req: Request, { params }: Params) {
  const { code } = await params;
  const { bookmarks } = await req.json() as { bookmarks: string[] };
  const { error } = await supabaseAdmin
    .from('access_codes')
    .update({ bookmarks })
    .eq('code', code.toUpperCase());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
