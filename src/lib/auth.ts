import { auth } from './auth-config';

export async function getAdminSession(): Promise<boolean> {
  const session = await auth();
  return !!session;
}

// Legacy cookie helpers kept for any remaining references
export function setAdminCookie(response: Response, secret: string) {
  void secret;
  void response;
}
export function clearAdminCookie(response: Response) {
  void response;
}
