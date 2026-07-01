import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const TOKEN_COOKIE = 'admin_token';

function baseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('Thiếu API_BASE_URL (xem .env.example).');
  }
  return url;
}

/** Fetch tới NestJS backend, tự gắn Bearer token từ cookie httpOnly. */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

/** GET + parse JSON. 401/403 → redirect /login (token thiếu/hết hạn). */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`API lỗi ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}
