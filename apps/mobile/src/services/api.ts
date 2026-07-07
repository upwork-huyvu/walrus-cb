// Client mobile → backend cho các endpoint user-facing (hiện chỉ /push/tokens).
// Gắn header x-api-key (PUSH_API_KEY). Dùng global fetch của RN.
import { API_BASE_URL, PUSH_API_KEY } from '../config/api';

export type Platform = 'android' | 'ios';

async function req(path: string, method: 'POST' | 'DELETE', body: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PUSH_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${method} ${path} lỗi ${res.status}`);
  }
}

/** Đăng ký/cập nhật FCM token gắn với Tuya uid. */
export function registerPushToken(tuyaUid: string, token: string, platform: Platform): Promise<void> {
  return req('/push/tokens', 'POST', { tuyaUid, token, platform });
}

/** Gỡ FCM token (logout). */
export function unregisterPushToken(token: string): Promise<void> {
  return req('/push/tokens', 'DELETE', { token });
}
