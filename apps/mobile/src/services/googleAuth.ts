// Lấy Google idToken (native Google Sign-In) để truyền vào Tuya `thirdLogin(idToken, 'gg')`.
// Pattern require try/catch + cờ `googleAvailable` như services/auth.ts: khi Metro chưa build
// native, module native (getEnforcing) crash lúc import → phải require động + fallback mock cho dev.
// Xem docs/research/tuya-google-login.md (luồng + checklist console).
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '../config/google';

let mod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  mod = require('@react-native-google-signin/google-signin');
} catch {
  mod = null;
}

const GoogleSignin: any = mod?.GoogleSignin ?? null;
const statusCodes: any = mod?.statusCodes ?? null;

export const googleAvailable: boolean = GoogleSignin != null;

// Lỗi có mã để UI phân biệt "user huỷ" (im lặng) với lỗi cấu hình/thật.
export type GoogleErrorCode = 'CANCELLED' | 'NO_CONFIG' | 'NO_ID_TOKEN' | 'PLAY_SERVICES' | 'UNKNOWN';
export class GoogleSignInError extends Error {
  code: GoogleErrorCode;
  constructor(code: GoogleErrorCode, message: string) {
    super(message);
    this.name = 'GoogleSignInError';
    this.code = code;
  }
}

const MOCK_ID_TOKEN = 'mock-google-id-token'; // dev/Metro: auth.thirdLogin mock bỏ qua token.

let configured = false;

// Gọi 1 lần lúc app khởi động (cạnh initSdk). KHÔNG throw ở đây để không chặn boot khi client id trống.
export function configureGoogle(): void {
  if (!googleAvailable || configured) return;
  GoogleSignin.configure({
    // idToken audience = Web Client ID; BẮT BUỘC type WEB, nếu không idToken = null.
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: true, // cần để nhận idToken/refresh token
  });
  configured = true;
}

// Trả Google idToken; throw GoogleSignInError nếu huỷ / thiếu cấu hình / không có token.
export async function signInGoogle(): Promise<string> {
  if (!googleAvailable) return MOCK_ID_TOKEN; // chưa build native → chạy luồng mock

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new GoogleSignInError(
      'NO_CONFIG',
      'Google Web Client ID (type WEB) is not configured in src/config/google.ts - see docs/research/tuya-google-login.md.',
    );
  }
  configureGoogle();

  try {
    // Android cần Google Play services (iOS: no-op).
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (e: any) {
    throw new GoogleSignInError('PLAY_SERVICES', e?.message ?? 'Google Play services is unavailable.');
  }

  let res: any;
  try {
    res = await GoogleSignin.signIn();
  } catch (e: any) {
    const code = e?.code;
    if (statusCodes && (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS)) {
      throw new GoogleSignInError('CANCELLED', 'Google sign-in was cancelled.');
    }
    throw new GoogleSignInError('UNKNOWN', e?.message ?? String(e));
  }

  // v13+: signIn trả { type: 'success' | 'cancelled', data }. Huỷ = type !== 'success'.
  if (res?.type && res.type !== 'success') {
    throw new GoogleSignInError('CANCELLED', 'Google sign-in was cancelled.');
  }
  const idToken: string | null = res?.data?.idToken ?? res?.idToken ?? null;
  if (!idToken) {
    throw new GoogleSignInError(
      'NO_ID_TOKEN',
      'Google did not return an idToken - make sure webClientId is of type WEB. See docs/research/tuya-google-login.md.',
    );
  }
  return idToken;
}

// Đăng xuất Google (gọi kèm logout Tuya). Best-effort - nuốt lỗi.
export async function signOutGoogle(): Promise<void> {
  if (!googleAvailable) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    /* nuốt - vẫn coi như đã đăng xuất */
  }
}
