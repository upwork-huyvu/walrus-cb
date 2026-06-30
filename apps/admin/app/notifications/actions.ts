'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export type SendPushState = {
  ok?: boolean;
  sendStatus?: boolean;
  error?: string;
};

/**
 * Server Action: gửi push tới 1 user qua backend (Tuya Cloud App Push).
 * Đọc uid + templateId + các biến `param.<tên>` từ FormData → POST /notifications/push.
 */
export async function sendPushAction(
  _prev: SendPushState,
  formData: FormData,
): Promise<SendPushState> {
  const uid = String(formData.get('uid') ?? '').trim();
  const templateId = String(formData.get('templateId') ?? '').trim();
  if (!uid || !templateId) {
    return { error: 'Thiếu UID hoặc template.' };
  }

  // Gom biến template: các field đặt tên "param.<tên>".
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('param.')) {
      params[key.slice('param.'.length)] = String(value);
    }
  }

  const res = await apiFetch('/notifications/push', {
    method: 'POST',
    body: JSON.stringify({ uid, templateId, params }),
  });
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    return { error: `Gửi thất bại: ${res.status}` };
  }
  const data = (await res.json()) as { send_status?: boolean };
  return { ok: true, sendStatus: data.send_status ?? false };
}
