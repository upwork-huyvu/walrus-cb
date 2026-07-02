'use client';

import { useState, useTransition } from 'react';
import { deleteAdmin } from '@/app/admins/actions';

export default function DeleteAdminButton({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'flex-end',
      }}
    >
      {error ? <span className="error">{error}</span> : null}
      <button
        className="danger"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              `Gỡ quyền admin của ${email}? (không xoá tài khoản, chỉ mất quyền truy cập)`,
            )
          ) {
            setError('');
            startTransition(async () => {
              const r = await deleteAdmin(id);
              if (r?.error) setError(r.error);
            });
          }
        }}
      >
        {pending ? 'Đang gỡ…' : 'Gỡ quyền'}
      </button>
    </div>
  );
}
