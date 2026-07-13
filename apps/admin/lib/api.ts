import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';

const TOKEN_COOKIE = 'admin_token';

function baseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('Missing API_BASE_URL (see .env.example).');
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
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * Provider gửi thông báo đang bật (backend `NOTIFICATION_PROVIDER`).
 * - Auth-fail (401/403): `apiGet` gọi `redirect('/login')` → `unstable_rethrow` để redirect THỰC SỰ chạy
 *   (KHÔNG nuốt) → session hết hạn bị đá về login, không âm thầm giả làm chế độ khác.
 * - Lỗi khác (mạng/5xx): fallback **'fcm'** (provider dự án đang dùng) - không chặn render trang.
 * Trước đây các trang tự `try/catch { default 'tuya' }` → nuốt cả redirect → hết hạn vẫn hiện "Tuya".
 */
export async function getActiveProvider(): Promise<string> {
  try {
    const p = await apiGet<{ provider?: string }>('/notifications/provider');
    return p.provider || 'fcm';
  } catch (e) {
    unstable_rethrow(e); // re-throw NEXT_REDIRECT/notFound; chỉ nuốt lỗi data thật
    return 'fcm';
  }
}
