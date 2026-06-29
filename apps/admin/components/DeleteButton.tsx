'use client';

import { useTransition } from 'react';
import { deleteUser } from '@/app/users/[uid]/actions';

export default function DeleteButton({ uid }: { uid: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="danger"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            'Xoá user này? (Tuya pre-delete có ân hạn 7 ngày + xoá dữ liệu business)',
          )
        ) {
          startTransition(() => {
            void deleteUser(uid);
          });
        }
      }}
    >
      {pending ? 'Đang xoá…' : 'Xoá user'}
    </button>
  );
}
