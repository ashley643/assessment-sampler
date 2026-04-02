import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes (not /admin itself — that's the login page)
  if (pathname.startsWith('/admin/') || pathname === '/admin/dashboard') {
    const token = request.cookies.get('admin_session')?.value;
    if (token !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
