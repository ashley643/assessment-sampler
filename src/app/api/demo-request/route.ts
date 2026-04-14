import { NextResponse } from 'next/server';
import { sendDemoReceipt, sendDemoNotification } from '@/lib/pilot-emails';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { name, email, org, phone, notes } = body;
  if (!name || !email || !org) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (process.env.RESEND_API_KEY) {
    await Promise.allSettled([
      sendDemoReceipt({ name, email, org }),
      sendDemoNotification({ name, email, org, phone, notes }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
