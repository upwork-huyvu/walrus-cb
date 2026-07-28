'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export type ControlInput = {
  target?: number;
  power?: boolean;
  light?: boolean;
  purify?: boolean;
};

export type CommandResult = { ok: boolean; error?: string };

/**
 * Server Action: gửi lệnh điều khiển tới backend (backend → Tuya Cloud).
 * Trả `{ok:false, error}` (KHÔNG throw) để panel hiện lỗi tại chỗ - trừ auth-fail thì redirect /login.
 */
export async function sendDeviceCommand(
  id: string,
  input: ControlInput,
): Promise<CommandResult> {
  const res = await apiFetch(`/admin/devices/${id}/commands`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    let msg = `Command failed (${res.status})`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      // giữ msg mặc định
    }
    return { ok: false, error: msg };
  }
  // Đọc lại trạng thái mới ở lần render sau.
  revalidatePath(`/devices/${id}`);
  revalidatePath('/devices');
  return { ok: true };
}
