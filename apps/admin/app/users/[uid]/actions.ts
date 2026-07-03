'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

/** Server Action: xoá user (NestJS DELETE = Tuya pre-delete + xoá business data). */
export async function deleteUser(uid: string): Promise<void> {
  const res = await apiFetch(`/users/${uid}`, { method: 'DELETE' });
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    throw new Error(`Failed to delete user: ${res.status}`);
  }
  revalidatePath('/users');
  redirect('/users');
}
