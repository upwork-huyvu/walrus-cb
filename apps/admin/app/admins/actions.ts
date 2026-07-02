'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

/**
 * Server Action: gỡ 1 admin khỏi allowlist (NestJS DELETE /admin/users/:id).
 * 401 = token hết hạn → login. 403/404 = lỗi nghiệp vụ (tự-xoá-mình / không tồn tại) → trả message.
 */
export async function deleteAdmin(id: string): Promise<{ error?: string }> {
  const res = await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
  if (res.status === 401) {
    redirect('/login');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { error: body?.message ?? `Gỡ admin thất bại (${res.status})` };
  }
  revalidatePath('/admins');
  return {};
}
