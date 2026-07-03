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
            'Delete this user? (Tuya pre-delete has a 7-day grace period; business data is also removed)',
          )
        ) {
          startTransition(() => {
            void deleteUser(uid);
          });
        }
      }}
    >
      {pending ? 'Deleting…' : 'Delete user'}
    </button>
  );
}
