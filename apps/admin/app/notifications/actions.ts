'use server';

import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export type SendPushState = {
  ok?: boolean;
  total?: number;
  success?: number;
  failed?: number;
  error?: string;
};

/**
 * Server Action: gửi push qua backend (Tuya Cloud App Push).
 * Người nhận: mode='all' (tất cả) hoặc danh sách `uids` (JSON). Biến từ field `param.<tên>`.
 * Backend loop per-uid → trả {total, success, failed}.
 */
export async function sendPushAction(
  _prev: SendPushState,
  formData: FormData,
): Promise<SendPushState> {
  const templateId = String(formData.get('templateId') ?? '').trim();
  const all = String(formData.get('mode') ?? 'select') === 'all';
  if (!templateId) {
    return { error: 'Template is required.' };
  }

  let uids: string[] = [];
  if (!all) {
    try {
      const parsed = JSON.parse(String(formData.get('uids') ?? '[]'));
      if (Array.isArray(parsed)) uids = parsed.map((x) => String(x));
    } catch {
      uids = [];
    }
    if (uids.length === 0) {
      return { error: 'Select at least one recipient (or choose "Send to all").' };
    }
  }

  // Gom biến template: field đặt tên "param.<tên>".
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('param.')) {
      params[key.slice('param.'.length)] = String(value);
    }
  }

  const body = all
    ? { templateId, params, all: true }
    : { templateId, params, uids };

  const res = await apiFetch('/notifications/push', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    redirect('/login');
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { message?: string } | null;
    return { error: b?.message ?? `Send failed: ${res.status}` };
  }
  const data = (await res.json()) as {
    total?: number;
    success?: number;
    failed?: number;
  };
  return {
    ok: true,
    total: data.total ?? 0,
    success: data.success ?? 0,
    failed: data.failed ?? 0,
  };
}
