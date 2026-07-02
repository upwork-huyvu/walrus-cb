import { NextResponse, type NextRequest } from 'next/server';

const TOKEN_COOKIE = 'admin_token';
const GATED = ['/users', '/notifications', '/admins'];

// Next 16: "proxy" thay cho "middleware". Chặn khu admin khi chưa có token.
export function proxy(req: NextRequest) {
  const hasToken = req.cookies.has(TOKEN_COOKIE);
  const { pathname } = req.nextUrl;

  if (!hasToken && GATED.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  // KHÔNG auto-bounce /login khi có token: token có thể còn cookie nhưng đã HẾT HẠN.
  // Nếu bounce sang /users, page 401 → redirect /login → bounce lại = vòng lặp vô hạn
  // (ERR_TOO_MANY_REDIRECTS). Để /login luôn vào được → user đăng nhập lại, cookie mới ghi đè.
  return NextResponse.next();
}

export const config = {
  matcher: ['/users/:path*', '/notifications/:path*', '/admins/:path*', '/login'],
};
