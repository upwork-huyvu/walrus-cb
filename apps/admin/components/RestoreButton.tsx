'use client';

import { useTransition } from 'react';
import { restoreUser } from '@/app/users/deleted/actions';

/**
 * Khôi phục user khỏi thùng rác. Không hỏi xác nhận: đây là hành động AN TOÀN và đảo ngược được
 * (bấm nhầm thì xoá lại), nên thêm một hộp thoại chỉ tổ làm người dùng chai lì với confirm - để
 * dành sự chú ý đó cho nút xoá vĩnh viễn bên cạnh.
 */
export default function RestoreButton({ uid }: { uid: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-sm"
      disabled={pending}
      onClick={() => startTransition(() => void restoreUser(uid))}
      title="Cancel the scheduled deletion and put this account back in the customer list"
    >
      {pending ? 'Restoring…' : 'Restore'}
    </button>
  );
}
