'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

/**
 * Server Action: xoá VĨNH VIỄN một user khỏi thùng rác.
 * Khác `deleteUser` (pre-delete, ân hạn 7 ngày) - cái này gọi hard-delete của Tuya, không hoàn tác.
 */
export async function purgeUser(uid: string): Promise<void> {
  const res = await apiFetch(`/users/${uid}/permanent`, { method: 'DELETE' });
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Failed to permanently delete user: ${res.status}`);
  }
  revalidatePath('/users/deleted');
  revalidatePath('/users');
}

/**
 * Server Action: khôi phục user khỏi thùng rác (huỷ pre-delete ở Tuya).
 * Chỉ dùng được trong 7 ngày ân hạn - quá hạn Tuya đã xoá thật, gọi sẽ lỗi.
 */
export async function restoreUser(uid: string): Promise<void> {
  const res = await apiFetch(`/users/${uid}/restore`, { method: 'POST' });
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Failed to restore user: ${res.status}`);
  }
  revalidatePath('/users/deleted');
  revalidatePath('/users');
}
