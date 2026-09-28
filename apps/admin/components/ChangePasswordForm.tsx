'use client';

import { useActionState } from 'react';
import {
  changePasswordAction,
  type ChangePasswordState,
} from '@/app/(dashboard)/admins/actions';

const initialState: ChangePasswordState = {};

/** Đổi mật khẩu của CHÍNH tài khoản đang đăng nhập - admin thường cũng dùng được. */
export default function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="card" style={{ flex: '1 1 320px' }}>
      <h2 className="card-title" style={{ margin: 0 }}>Change your password</h2>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>
        Signed in as <strong>{email}</strong>. Your current password is required, so a
        borrowed session cannot take over the account.
      </p>
      <label>
        Current password
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        New password (≥8 characters)
        <input
          name="newPassword"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? (
        <p style={{ color: 'var(--success)', fontSize: 13, margin: 0 }}>
          ✅ Password changed. Use it the next time you sign in.
        </p>
      ) : null}

      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
