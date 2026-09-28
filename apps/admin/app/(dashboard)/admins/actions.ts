'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

/** Nest trả `message` khi là string, khi là string[] (lỗi validate DTO) - gom về một dòng. */
async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const msg = body?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  return msg ?? `${fallback} (${res.status})`;
}

/**
 * Server Action: gỡ 1 admin khỏi allowlist (NestJS DELETE /admin/users/:id).
 * 401 = token hết hạn → login. 403/404 = lỗi nghiệp vụ (không phải superadmin / gỡ superadmin /
 * không tồn tại) → trả message cho UI.
 */
export async function deleteAdmin(id: string): Promise<{ error?: string }> {
  const res = await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
  if (res.status === 401) {
    redirect('/login');
  }
  if (!res.ok) {
    return { error: await readError(res, 'Failed to remove admin') };
  }
  revalidatePath('/admins');
  return {};
}

export type CreateAdminState = {
  error?: string;
  /** Email vừa được cấp quyền - có giá trị nghĩa là thành công. */
  addedEmail?: string;
  /** false = email đã có sẵn tài khoản Supabase ⇒ mật khẩu vừa nhập KHÔNG được dùng. */
  created?: boolean;
};

/** Server Action: thêm admin mới (chỉ superadmin gọi được - backend tự chặn). */
export async function createAdminAction(
  _prev: CreateAdminState,
  formData: FormData,
): Promise<CreateAdminState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email) {
    return { error: 'Enter an email address.' };
  }
  if (password.length < 8) {
    return { error: 'The password must be at least 8 characters.' };
  }

  const res = await apiFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) {
    redirect('/login');
  }
  if (!res.ok) {
    return { error: await readError(res, 'Failed to add admin') };
  }
  const body = (await res.json().catch(() => null)) as {
    email?: string;
    created?: boolean;
  } | null;

  revalidatePath('/admins');
  return { addedEmail: body?.email ?? email, created: body?.created !== false };
}

export type ChangePasswordState = { error?: string; ok?: boolean };

/**
 * Server Action: tự đổi mật khẩu của chính mình.
 *
 * Backend trả **400** khi mật khẩu hiện tại sai (không phải 401) - nhờ vậy ở đây vẫn giữ được luật
 * "401 = hết phiên → /login" mà gõ sai mật khẩu không bị đá ra ngoài.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!currentPassword) {
    return { error: 'Enter your current password.' };
  }
  if (newPassword.length < 8) {
    return { error: 'The new password must be at least 8 characters.' };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'The new password and its confirmation do not match.' };
  }

  const res = await apiFetch('/admin/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.status === 401) {
    redirect('/login');
  }
  if (!res.ok) {
    return { error: await readError(res, 'Failed to change the password') };
  }
  return { ok: true };
}
