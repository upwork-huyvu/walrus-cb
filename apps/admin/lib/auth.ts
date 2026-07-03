'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const TOKEN_COOKIE = 'admin_token';

export type LoginState = { error?: string };

type LoginResponse = { access_token: string };

/** Server Action: đăng nhập qua proxy NestJS /admin/auth/login (Supabase Auth + allowlist admin). */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return { error: 'Enter both email and password.' };
  }

  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) {
    return { error: 'Missing API_BASE_URL config on the server.' };
  }

  const res = await fetch(`${apiBase}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return {
      error: 'Incorrect email or password, or the account lacks admin access.',
    };
  }
  const data = (await res.json()) as LoginResponse;

  const jar = await cookies();
  jar.set(TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  redirect('/users');
}

/** Server Action: xoá cookie session + quay về /login. */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  redirect('/login');
}
