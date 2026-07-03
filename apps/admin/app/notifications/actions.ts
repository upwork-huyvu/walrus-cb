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
 * Server Action: gửi thông báo FCM TỰ DO (không template) qua backend `/push/send`.
 * title (tên) + body (mô tả) + data (điều hướng khi tap) + người nhận (uids JSON / all).
 * Backend gửi per-uid → trả {total, success, failed}.
 */
export async function sendPushAction(
  _prev: SendPushState,
  formData: FormData,
): Promise<SendPushState> {
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
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

  // data điều hướng khi tap (tuỳ chọn).
  const data: Record<string, string> = {};
  const screen = String(formData.get('screen') ?? '').trim();
  const devId = String(formData.get('devId') ?? '').trim();
  if (screen) data.screen = screen;
  if (devId) data.devId = devId;

  const payload: Record<string, unknown> = { title, body };
  if (Object.keys(data).length > 0) payload.data = data;
  if (all) payload.all = true;
  else payload.uids = uids;

  const res = await apiFetch('/push/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    redirect('/login');
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { message?: string } | null;
    return { error: b?.message ?? `Send failed: ${res.status}` };
  }
  const d = (await res.json()) as {
    total?: number;
    success?: number;
    failed?: number;
  };
  return {
    ok: true,
    total: d.total ?? 0,
    success: d.success ?? 0,
    failed: d.failed ?? 0,
  };
}
