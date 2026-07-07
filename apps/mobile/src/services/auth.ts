// Adapter auth: dùng Tuya Auth nếu native có; nếu KHÔNG (Metro chưa build native) → mock để luồng
// login/register chạy được trong dev. Cùng pattern require try/catch như services/{tuya,pairing}.
export type AuthUser = {
  uid: string;
  email: string;
  nickName: string;
  sessionId: string;
  headPic: string;
  mobile: string;
  tempUnit: number;
  timezoneId: string;
  countryCode: string;
  regionCode: string;
};
export type Subscription = { remove(): void };
export type LoginIdentityKind = 'email' | 'phone';
export type LoginIdentityMode = 'bind' | 'change';

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

const MOCK_USER: AuthUser = {
  uid: 'mock-uid',
  email: 'demo@walrus.app',
  nickName: 'Demo',
  sessionId: 'mock-session',
  headPic: '',
  mobile: '',
  tempUnit: 1,
  timezoneId: 'Europe/Berlin',
  countryCode: DEFAULT_COUNTRY,
  regionCode: '',
};
let mockLoggedIn = false;
let mockUser: AuthUser = MOCK_USER;

function mapUser(u: any): AuthUser {
  return {
    uid: u?.uid ?? '',
    email: u?.email ?? '',
    nickName: u?.nickName ?? '',
    sessionId: u?.sessionId ?? '',
    headPic: u?.headPic ?? '',
    mobile: u?.mobile ?? '',
    tempUnit: Number(u?.tempUnit ?? 0),
    timezoneId: u?.timezoneId ?? '',
    countryCode: u?.countryCode ?? '',
    regionCode: u?.regionCode ?? '',
  };
}

export async function sendEmailCode(email: string, country: string, type: CodeType): Promise<void> {
  if (!authAvailable) return; // mock: bỏ qua, code bất kỳ chấp nhận
  await lib.Tuya.sendVerifyCode(email, country, type);
}

// Đổi password = reset qua OTP email (Tuya App SDK KHÔNG có change-by-old-password khi đang login).
// Flow: sendEmailCode(type 3) → resetPassword(code, newPassword). Sau reset nên đăng nhập lại.
export async function resetPassword(
  country: string,
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  if (!authAvailable) return; // mock: chấp nhận
  await lib.Tuya.resetEmailPassword(country, email, code, newPassword);
}

export async function registerEmail(country: string, email: string, password: string, code: string): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    mockUser = { ...MOCK_USER, email };
    return mockUser;
  }
  return mapUser(await lib.Tuya.registerWithEmail(country, email, password, code));
}

export async function loginEmail(country: string, email: string, password: string): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    mockUser = { ...MOCK_USER, email };
    return mockUser;
  }
  return mapUser(await lib.Tuya.loginWithEmail(country, email, password));
}

export async function loginEmailCode(country: string, email: string, code: string): Promise<AuthUser> {
  if (!authAvailable) {
    mockLoggedIn = true;
    mockUser = { ...MOCK_USER, email };
    return mockUser;
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
    mockUser = MOCK_USER;
    return mockUser;
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
  if (!authAvailable) return mockLoggedIn ? mockUser : null;
  try {
    return mapUser(await lib.Tuya.getCurrentUser());
  } catch {
    return null; // reject 'no_user' → chưa đăng nhập
  }
}

export async function syncUserInfo(): Promise<AuthUser | null> {
  if (!authAvailable) return mockLoggedIn ? mockUser : null;
  try {
    return mapUser(await lib.Tuya.syncUserInfo());
  } catch {
    return null;
  }
}

export async function updateNickname(nickName: string): Promise<AuthUser | null> {
  const clean = nickName.trim();
  if (!clean) throw new Error('Display name cannot be empty.');
  if (!authAvailable) {
    mockUser = { ...mockUser, nickName: clean };
    return mockLoggedIn ? mockUser : null;
  }
  await lib.Tuya.updateNickname(clean);
  return (await syncUserInfo()) ?? (await getCurrentUser());
}

export async function updateTempUnit(unit: number): Promise<AuthUser | null> {
  if (unit !== 1 && unit !== 2) throw new Error('Temperature unit must be Celsius or Fahrenheit.');
  if (!authAvailable) {
    mockUser = { ...mockUser, tempUnit: unit };
    return mockLoggedIn ? mockUser : null;
  }
  await lib.Tuya.updateTempUnit(unit);
  return (await syncUserInfo()) ?? (await getCurrentUser());
}

export async function updateTimeZone(timezoneId: string): Promise<AuthUser | null> {
  const clean = timezoneId.trim();
  if (!clean) throw new Error('Timezone cannot be empty.');
  if (!authAvailable) {
    mockUser = { ...mockUser, timezoneId: clean };
    return mockLoggedIn ? mockUser : null;
  }
  await lib.Tuya.updateTimeZone(clean);
  return (await syncUserInfo()) ?? (await getCurrentUser());
}

export async function updateAccountProfile(input: {
  nickName?: string;
  tempUnit?: number;
  timezoneId?: string;
}): Promise<AuthUser | null> {
  let updated: AuthUser | null = null;
  if (input.nickName != null) updated = await updateNickname(input.nickName);
  if (input.tempUnit != null) updated = await updateTempUnit(input.tempUnit);
  if (input.timezoneId != null) updated = await updateTimeZone(input.timezoneId);
  return updated ?? (await syncUserInfo()) ?? (await getCurrentUser());
}

function requireIdentityValue(kind: LoginIdentityKind, value: string): string {
  const clean = value.trim();
  if (!clean) throw new Error(kind === 'email' ? 'Email cannot be empty.' : 'Phone number cannot be empty.');
  if (kind === 'email' && !clean.includes('@')) throw new Error('Enter a valid email address.');
  return clean;
}

export async function sendLoginIdentityCode(
  kind: LoginIdentityKind,
  countryCode: string,
  value: string,
): Promise<void> {
  const clean = requireIdentityValue(kind, value);
  const country = countryCode.trim() || DEFAULT_COUNTRY;
  if (!authAvailable) return;
  if (kind === 'email') await lib.Tuya.sendBindEmailCode(country, clean);
  else await lib.Tuya.sendBindPhoneCode(country, clean);
}

export async function updateLoginIdentity(
  kind: LoginIdentityKind,
  mode: LoginIdentityMode,
  countryCode: string,
  value: string,
  code: string,
): Promise<AuthUser | null> {
  const cleanValue = requireIdentityValue(kind, value);
  const cleanCode = code.trim();
  if (!cleanCode) throw new Error('Verification code cannot be empty.');
  const country = countryCode.trim() || DEFAULT_COUNTRY;
  const current = await getCurrentUser();
  const sessionId = current?.sessionId ?? '';
  if (!sessionId && mode === 'change') throw new Error('Missing session ID. Refresh account info and try again.');

  if (!authAvailable) {
    mockUser = {
      ...mockUser,
      countryCode: country,
      email: kind === 'email' ? cleanValue : mockUser.email,
      mobile: kind === 'phone' ? cleanValue : mockUser.mobile,
    };
    return mockLoggedIn ? mockUser : null;
  }

  if (mode === 'change') {
    await lib.Tuya.changeUserName(country, cleanCode, sessionId, cleanValue);
  } else if (kind === 'email') {
    await lib.Tuya.bindEmail(country, cleanValue, cleanCode, sessionId);
  } else {
    await lib.Tuya.bindMobile(country, cleanValue, cleanCode);
  }
  return (await syncUserInfo()) ?? (await getCurrentUser());
}

export async function cancelAccount(): Promise<void> {
  if (!authAvailable) {
    mockLoggedIn = false;
    mockUser = MOCK_USER;
    return;
  }
  await lib.Tuya.cancelAccount();
}

export async function logout(): Promise<void> {
  if (!authAvailable) {
    mockLoggedIn = false;
    mockUser = MOCK_USER;
    return;
  }
  try {
    await lib.Tuya.logout();
  } catch {
    /* nuốt - vẫn coi như đã đăng xuất ở UI */
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
