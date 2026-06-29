import { NextResponse, type NextRequest } from 'next/server';

const TOKEN_COOKIE = 'admin_token';

// Next 16: "proxy" thay cho "middleware". Chặn /users/* khi chưa đăng nhập.
export function proxy(req: NextRequest) {
  const hasToken = req.cookies.has(TOKEN_COOKIE);
  const { pathname } = req.nextUrl;

  if (!hasToken && pathname.startsWith('/users')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (hasToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/users', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/users/:path*', '/login'],
};
