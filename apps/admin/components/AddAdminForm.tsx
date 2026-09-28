'use client';

import { useActionState } from 'react';
import {
  createAdminAction,
  type CreateAdminState,
} from '@/app/(dashboard)/admins/actions';

const initialState: CreateAdminState = {};

/**
 * Form thêm admin mới. Chỉ render cho superadmin (backend vẫn chặn lại lần nữa - UI ẩn đi không
 * phải là kiểm soát quyền).
 */
export default function AddAdminForm() {
  const [state, formAction, pending] = useActionState(
    createAdminAction,
    initialState,
  );

  return (
    <form action={formAction} className="card" style={{ flex: '1 1 320px' }}>
      <h2 className="card-title" style={{ margin: 0 }}>Add admin</h2>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>
        Creates the Supabase account and grants admin access. New admins get the
        <strong> Admin</strong> role - only the superadmin can add or revoke access.
      </p>
      <label>
        Email
        <input name="email" type="email" autoComplete="off" required />
      </label>
      <label>
        Password (≥8 characters)
        <input
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.addedEmail ? (
        <p style={{ color: 'var(--success)', fontSize: 13, margin: 0 }}>
          {state.created
            ? `✅ ${state.addedEmail} can now sign in as an admin.`
            : `✅ ${state.addedEmail} now has admin access. That email already had a Supabase account, so its existing password was kept - the one you typed was not used.`}
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add admin'}
      </button>
    </form>
  );
}
