// Adapter auth: dùng Tuya Auth nếu native có; nếu KHÔNG (Metro chưa build native) → mock để luồng
// login/register chạy được trong dev. Cùng pattern require try/catch như services/{tuya,pairing}.
export type AuthUser = { uid: string; email: string; nickName: string };
export type Subscription = { remove(): void };

// type mã xác thực: 1 register · 2 login · 3 reset.
export type CodeType = 1 | 2 | 3;

const DEFAULT_COUNTRY = '49'; // EU mặc định (đổi qua field ở UI)

let lib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}
export const authAvailable: boolean = lib != null && lib.Tuya != null;

const MOCK_USER: AuthUser = { uid: 'mock-uid', email: 'demo@walrus.app', nickName: 'Demo' };
let mockLoggedIn = false;

function mapUser(u: any): AuthUser {
  return { uid: u?.uid ?? '', email: u?.email ?? '', nickName: u?.nickName ?? '' };
}

export async function sendEmailCode(email: string, country: string, type: CodeType): Promise<void> {
  if (!authAvailable) return; // mock: bỏ qua, code bất kỳ chấp nhận
  await lib.Tuya.sendVerifyCode(email, country, type);
}

export async function registerEmail(country: string, email: string, password: string, code: string): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    return { ...MOCK_USER, email };
  }
  return mapUser(await lib.Tuya.registerWithEmail(country, email, password, code));
}

export async function loginEmail(country: string, email: string, password: string): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    return { ...MOCK_USER, email };
  }
  return mapUser(await lib.Tuya.loginWithEmail(country, email, password));
}

export async function loginEmailCode(country: string, email: string, code: string): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    return { ...MOCK_USER, email };
  }
  return mapUser(await lib.Tuya.loginWithEmailCode(country, email, code));
}

// type: 'gg' Google (idToken) · 'ap' Apple (identityToken) · 'fb' Facebook. token = từ native SDK.
// extra: chỉ cho Apple → {userIdentifier,email,nickname,snsNickname} (Apple chỉ trả lần đầu authorize).
// Bridge iOS parse extraInfo JSON string → NSDictionary (docs/research/tuya-ios-third-party-login.md).
export async function thirdLogin(
  token: string,
  type: 'gg' | 'ap' | 'fb',
  extra?: Record<string, string | undefined>,
  country: string = DEFAULT_COUNTRY, // countryCode → Tuya suy ra data center (không override được ở client)
): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    return MOCK_USER;
  }
  const extraInfo =
    type === 'gg' ? '{"pubVersion":1}' : type === 'ap' && extra ? JSON.stringify(extra) : '';
  return mapUser(await lib.Tuya.thirdLogin(country, token, type, extraInfo));
}

export async function isLoggedIn(): Promise<boolean> {
  if (!authAvailable) return mockLoggedIn;
  try {
    return await lib.Tuya.isLoggedIn();
  } catch {
    return false;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!authAvailable) return mockLoggedIn ? MOCK_USER : null;
  try {
    return mapUser(await lib.Tuya.getCurrentUser());
  } catch {
    return null; // reject 'no_user' → chưa đăng nhập
  }
}

export async function logout(): Promise<void> {
  if (!authAvailable) {
    mockLoggedIn = false;
    return;
  }
  try {
    await lib.Tuya.logout();
  } catch {
    /* nuốt — vẫn coi như đã đăng xuất ở UI */
  }
}

// Phiên hết hạn (kick-off/reset/xoá account) → route về auth.
export function onSessionExpired(cb: () => void): Subscription {
  if (!authAvailable) return { remove() {} };
  try {
    return lib.onSessionExpired(() => cb());
  } catch {
    return { remove() {} };
  }
}

export function describeError(e: any): string {
  const code = e?.code ?? e?.userInfo?.code;
  if (authAvailable && lib.TuyaErrors && code != null) {
    try {
      return lib.TuyaErrors.describe(code);
    } catch {
      /* fallthrough */
    }
  }
  return e?.message ?? String(e);
}
