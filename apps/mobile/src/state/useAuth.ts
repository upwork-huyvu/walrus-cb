import { useCallback, useState } from 'react';
import {
  cancelAccount,
  getCurrentUser,
  isLoggedIn,
  logout as authLogout,
  sendLoginIdentityCode as authSendLoginIdentityCode,
  syncUserInfo,
  updateAccountProfile as authUpdateAccountProfile,
  updateLoginIdentity as authUpdateLoginIdentity,
  updateNickname as authUpdateNickname,
  type LoginIdentityKind,
  type LoginIdentityMode,
  type AuthUser,
} from '../services/auth';
import { signOutGoogle } from '../services/googleAuth';
import { syncPushToken, removePushToken } from '../services/push';

export type AuthStatus = 'checking' | 'authed' | 'guest';

export type Auth = {
  user: AuthUser | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  onAuthed: (u: AuthUser) => void;
  refreshUser: () => Promise<AuthUser | null>;
  updateDisplayName: (name: string) => Promise<AuthUser>;
  updateProfile: (input: { nickName?: string; tempUnit?: number; timezoneId?: string }) => Promise<AuthUser>;
  sendIdentityCode: (kind: LoginIdentityKind, countryCode: string, value: string) => Promise<void>;
  updateIdentity: (
    kind: LoginIdentityKind,
    mode: LoginIdentityMode,
    countryCode: string,
    value: string,
    code: string,
  ) => Promise<AuthUser>;
  deleteAccount: () => Promise<void>;
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
        const u = await getCurrentUser();
        setUser(u);
        setStatus('authed');
        if (u?.uid) void syncPushToken(u.uid); // đăng ký FCM token (Tuya + backend) cho phiên đã đăng nhập sẵn
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
    void syncPushToken(u.uid); // đăng ký FCM token (Tuya + backend) ngay sau login
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await syncUserInfo();
    setUser(u);
    setStatus(u ? 'authed' : 'guest');
    return u;
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const u = await authUpdateNickname(name);
    if (!u) throw new Error('Could not refresh account information.');
    setUser(u);
    setStatus('authed');
    return u;
  }, []);

  const updateProfile = useCallback(async (input: { nickName?: string; tempUnit?: number; timezoneId?: string }) => {
    const u = await authUpdateAccountProfile(input);
    if (!u) throw new Error('Could not refresh account information.');
    setUser(u);
    setStatus('authed');
    return u;
  }, []);

  const sendIdentityCode = useCallback(
    async (kind: LoginIdentityKind, countryCode: string, value: string) =>
      authSendLoginIdentityCode(kind, countryCode, value),
    [],
  );

  const updateIdentity = useCallback(
    async (
      kind: LoginIdentityKind,
      mode: LoginIdentityMode,
      countryCode: string,
      value: string,
      code: string,
    ) => {
      const u = await authUpdateLoginIdentity(kind, mode, countryCode, value, code);
      if (!u) throw new Error('Could not refresh account information.');
      setUser(u);
      setStatus('authed');
      return u;
    },
    [],
  );

  // Phiên hết hạn (session chết phía SDK) - không gọi logout, chỉ clear state.
  const reset = useCallback(() => {
    setUser(null);
    setStatus('guest');
  }, []);

  const signOut = useCallback(async () => {
    await removePushToken(); // xoá FCM token local (token cũ invalid → Tuya tự loại)
    await authLogout();
    // Clear cả state Google Sign-In, nếu không lần signIn() sau sẽ tự trả account đã cache
    // (không hiện picker → không đổi được tài khoản). Best-effort, đã nuốt lỗi bên trong.
    await signOutGoogle();
    setUser(null);
    setStatus('guest');
  }, []);

  const deleteAccount = useCallback(async () => {
    await removePushToken();
    await cancelAccount();
    await signOutGoogle();
    setUser(null);
    setStatus('guest');
  }, []);

  return {
    user,
    status,
    bootstrap,
    onAuthed,
    refreshUser,
    updateDisplayName,
    updateProfile,
    sendIdentityCode,
    updateIdentity,
    deleteAccount,
    signOut,
    reset,
  };
}
