import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin/') && pathname !== '/admin/') {
    // Check cookie-based session (works without NextAuth env vars)
    const cookieToken = request.cookies.get('admin_session')?.value;
    if (cookieToken && cookieToken === process.env.ADMIN_SECRET) {
      return NextResponse.next();
    }

    // Check NextAuth session (works once AUTH_SECRET is configured)
    try {
      const { auth } = await import('@/lib/auth-config');
      const session = await auth();
      if (session) return NextResponse.next();
    } catch {
      // NextAuth not configured — fall through
    }

    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path+'],
};
