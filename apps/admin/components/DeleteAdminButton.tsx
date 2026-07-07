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
              `Revoke admin access for ${email}? (the account is kept - only access is removed)`,
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
        {pending ? 'Revoking…' : 'Revoke'}
      </button>
    </div>
  );
}
