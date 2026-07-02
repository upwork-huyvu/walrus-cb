import { useCallback, useState } from 'react';
import { getCurrentUser, isLoggedIn, logout as authLogout, type AuthUser } from '../services/auth';
import { signOutGoogle } from '../services/googleAuth';

export type AuthStatus = 'checking' | 'authed' | 'guest';

export type Auth = {
  user: AuthUser | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  onAuthed: (u: AuthUser) => void;
  signOut: () => Promise<void>;
  reset: () => void;
};

// Quản phiên auth: bootstrap lúc khởi động (isLoggedIn → authed/guest), set khi login, clear khi logout/hết hạn.
export function useAuth(): Auth {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');

  const bootstrap = useCallback(async () => {
    setStatus('checking');
    try {
      if (await isLoggedIn()) {
        setUser(await getCurrentUser());
        setStatus('authed');
        return;
      }
    } catch {
      /* coi như chưa đăng nhập */
    }
    setUser(null);
    setStatus('guest');
  }, []);

  const onAuthed = useCallback((u: AuthUser) => {
    setUser(u);
    setStatus('authed');
  }, []);

  // Phiên hết hạn (session chết phía SDK) — không gọi logout, chỉ clear state.
  const reset = useCallback(() => {
    setUser(null);
    setStatus('guest');
  }, []);

  const signOut = useCallback(async () => {
    await authLogout();
    // Clear cả state Google Sign-In, nếu không lần signIn() sau sẽ tự trả account đã cache
    // (không hiện picker → không đổi được tài khoản). Best-effort, đã nuốt lỗi bên trong.
    await signOutGoogle();
    setUser(null);
    setStatus('guest');
  }, []);

  return { user, status, bootstrap, onAuthed, signOut, reset };
}
