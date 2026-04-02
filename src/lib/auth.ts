import { cookies } from 'next/headers';

const COOKIE = 'admin_session';

export async function getAdminSession(): Promise<boolean> {
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
