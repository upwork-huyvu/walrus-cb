'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/lib/auth';

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="center">
      <form action={formAction} className="card">
        <div className="sidebar-head" style={{ padding: '0 0 8px' }}>
          <span className="mark" style={{ fontSize: 26 }}>
            ❄
          </span>
          <div className="wordmark">
            Cool Bath
            <small>Admin</small>
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: 24 }}>Đăng nhập</h1>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {state.error ? <p className="error">{state.error}</p> : null}
        <button className="primary" type="submit" disabled={pending}>
          {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
