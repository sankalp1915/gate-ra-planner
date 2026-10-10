import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, safeEqual, sessionToken } from './lib/auth';

export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  if (req.nextUrl.pathname === '/login') return NextResponse.next();
  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? '';
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
