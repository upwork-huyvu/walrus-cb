'use client';

import { useTransition } from 'react';
import { purgeUser } from '@/app/users/deleted/actions';
import { IconTrash } from './Icons';

/**
 * Xoá vĩnh viễn từ thùng rác. Hỏi xác nhận kèm TÊN người dùng - ở màn này mọi dòng đều đã bị xoá
 * một lần rồi, nên chỉ hỏi "chắc chưa?" là quá dễ bấm nhầm dòng.
 */
export default function PurgeButton({ uid, name }: { uid: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            `Permanently delete ${name}?\n\nThis calls Tuya's permanent-delete API immediately. It cannot be undone.`,
          )
        ) {
          startTransition(() => {
            void purgeUser(uid);
          });
        }
      }}
    >
      {pending ? (
        'Deleting…'
      ) : (
        <>
          <IconTrash />
          Delete forever
        </>
      )}
    </button>
  );
}
