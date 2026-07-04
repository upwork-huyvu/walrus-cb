'use client';

import { useTransition } from 'react';
import { deleteUser } from '@/app/users/[uid]/actions';

/** Nút xoá gọn cho từng dòng bảng user (cùng server action với trang detail). */
export default function DeleteUserRowButton({
  uid,
  name,
}: {
  uid: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            `Delete user "${name}"? (Tuya pre-delete has a 7-day grace period; business data is also removed)`,
          )
        ) {
          startTransition(() => {
            void deleteUser(uid);
          });
        }
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
