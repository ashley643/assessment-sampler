import { auth } from './auth-config';
import { cookies } from 'next/headers';

const COOKIE = 'admin_session';

export async function getAdminSession(): Promise<boolean> {
  // Try NextAuth session first (works once AUTH_SECRET is set)
  try {
    const session = await auth();
    if (session) return true;
  } catch {
    // NextAuth not configured — fall through to cookie check
  }

  // Cookie-based fallback (works immediately with just ADMIN_SECRET)
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return token === process.env.ADMIN_SECRET;
}

export function setAdminCookie(response: Response, secret: string) {
  response.headers.set(
    'Set-Cookie',
    `${COOKIE}=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
  );
}

export function clearAdminCookie(response: Response) {
  response.headers.set(
    'Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
