'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export type CreateTemplateState = {
  ok?: boolean;
  templateId?: string;
  error?: string;
};

/** Server Action: tạo template (submit để Tuya duyệt) → POST /notifications/templates. */
export async function createTemplateAction(
  _prev: CreateTemplateState,
  formData: FormData,
): Promise<CreateTemplateState> {
  const name = String(formData.get('name') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const type = Number(formData.get('type') ?? 0);
  const remark = String(formData.get('remark') ?? '').trim();

  if (!name || !title || !content || !remark) {
    return { error: 'Điền đủ name / title / content / remark.' };
  }
  if (type !== 0 && type !== 1) {
    return { error: 'Loại template phải là 0 (operations) hoặc 1 (system).' };
  }

  const res = await apiFetch('/notifications/templates', {
    method: 'POST',
    body: JSON.stringify({ name, title, content, type, remark }),
  });
  if (res.status === 401 || res.status === 403) {
    redirect('/login');
  }
  if (!res.ok) {
    return { error: `Tạo template thất bại: ${res.status}` };
  }
  const data = (await res.json()) as { template_id?: string };
  revalidatePath('/notifications/templates');
  return { ok: true, templateId: data.template_id };
}
