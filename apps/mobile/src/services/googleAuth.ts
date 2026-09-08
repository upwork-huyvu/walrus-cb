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

// --- Log chẩn đoán. Lọc console Xcode/adb bằng "[GAUTH]".
// Native trả lỗi dạng NSError bọc qua bridge: `message` thường rỗng/vô nghĩa, thông tin thật nằm ở
// code/domain/userInfo. Console.log(error) chỉ in "[Error: ]" nên phải bóc tay từng trường.
function glog(step: string, data?: unknown): void {
  if (data === undefined) {
    console.log(`[GAUTH] ${step}`);
    return;
  }
  console.log(`[GAUTH] ${step}`, data);
}

function dumpError(e: any): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: e?.name,
    code: e?.code, // GoogleSignin trả statusCode ở đây (chuỗi hoặc số tuỳ nền tảng)
    message: e?.message,
    domain: e?.domain, // NSError domain, vd com.google.GIDSignIn
    userInfo: e?.userInfo, // NSError userInfo - hay chứa lý do thật
    nativeStackIOS: e?.nativeStackIOS ? '(có)' : undefined,
  };
  // Một số trường không enumerable nên spread/JSON bỏ qua → lấy nốt phần còn lại.
  try {
    for (const k of Object.getOwnPropertyNames(e ?? {})) {
      if (!(k in out) && k !== 'stack') out[k] = e[k];
    }
  } catch {
    /* bỏ qua */
  }
  return out;
}

// idToken là credential - KHÔNG in ra full. Chỉ in độ dài + vài ký tự đầu để đối chiếu.
function peekToken(t: string | null | undefined): string {
  if (!t) return '(null)';
  return `len=${t.length} head=${t.slice(0, 12)}…`;
}

glog('module loaded', { googleAvailable, hasStatusCodes: statusCodes != null });

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
  const cfg = {
    // idToken audience = Web Client ID; BẮT BUỘC type WEB, nếu không idToken = null.
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: true, // cần để nhận idToken/refresh token
  };
  // Client id là định danh công khai (không phải secret) → in đủ để đối chiếu với Google Console.
  glog('configure()', cfg);
  try {
    GoogleSignin.configure(cfg);
    configured = true;
    glog('configure() OK');
  } catch (e: any) {
    glog('configure() THẤT BẠI', dumpError(e));
    throw e;
  }
}

// Trả Google idToken; throw GoogleSignInError nếu huỷ / thiếu cấu hình / không có token.
export async function signInGoogle(): Promise<string> {
  glog('signInGoogle() BẮT ĐẦU');
  if (!googleAvailable) {
    glog('module native VẮNG → trả mock token (đang chạy Metro-only?)');
    return MOCK_ID_TOKEN; // chưa build native → chạy luồng mock
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    glog('THIẾU webClientId trong src/config/google.ts');
    throw new GoogleSignInError(
      'NO_CONFIG',
      'Google Web Client ID (type WEB) is not configured in src/config/google.ts - see docs/research/tuya-google-login.md.',
    );
  }
  configureGoogle();

  try {
    // Android cần Google Play services (iOS: no-op).
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    glog('hasPlayServices OK (iOS: no-op)');
  } catch (e: any) {
    glog('hasPlayServices THẤT BẠI', dumpError(e));
    throw new GoogleSignInError('PLAY_SERVICES', e?.message ?? 'Google Play services is unavailable.');
  }

  let res: any;
  try {
    glog('gọi GoogleSignin.signIn() - sheet Google sắp mở');
    res = await GoogleSignin.signIn();
    // In nguyên shape trả về: v13+ là { type, data }, bản cũ là { idToken, user } phẳng.
    glog('signIn() TRẢ VỀ', {
      type: res?.type,
      topLevelKeys: res ? Object.keys(res) : null,
      dataKeys: res?.data ? Object.keys(res.data) : null,
      hasIdToken: !!(res?.data?.idToken ?? res?.idToken),
      email: res?.data?.user?.email ?? res?.user?.email,
    });
  } catch (e: any) {
    const code = e?.code;
    glog('signIn() NÉM LỖI', dumpError(e));
    glog('đối chiếu statusCodes', {
      code,
      SIGN_IN_CANCELLED: statusCodes?.SIGN_IN_CANCELLED,
      IN_PROGRESS: statusCodes?.IN_PROGRESS,
      khớpCancelled: !!statusCodes && (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS),
    });
    if (statusCodes && (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS)) {
      throw new GoogleSignInError('CANCELLED', 'Google sign-in was cancelled.');
    }
    throw new GoogleSignInError('UNKNOWN', e?.message ?? String(e));
  }

  // v13+: signIn trả { type: 'success' | 'cancelled', data }. Huỷ = type !== 'success'.
  if (res?.type && res.type !== 'success') {
    glog(`signIn() trả type="${res.type}" (KHÔNG phải success) → coi là huỷ, UI sẽ IM LẶNG`);
    throw new GoogleSignInError('CANCELLED', 'Google sign-in was cancelled.');
  }
  const idToken: string | null = res?.data?.idToken ?? res?.idToken ?? null;
  glog('idToken', peekToken(idToken));
  if (!idToken) {
    glog('KHÔNG có idToken - webClientId có đúng type WEB không?');
    throw new GoogleSignInError(
      'NO_ID_TOKEN',
      'Google did not return an idToken - make sure webClientId is of type WEB. See docs/research/tuya-google-login.md.',
    );
  }
  glog('signInGoogle() THÀNH CÔNG → chuyển sang Tuya thirdLogin');
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
