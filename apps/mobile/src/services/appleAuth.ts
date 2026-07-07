// Lấy Apple identityToken (Sign in with Apple - iOS) + profile fields, để truyền vào Tuya
// loginByAuth2WithType 'ap' (bridge JS: thirdLogin(identityToken,'ap',extraInfo)).
// Xem docs/research/tuya-ios-third-party-login.md. Pattern require try/catch + cờ như googleAuth.ts.
//
// KHÁC googleAuth: require '@invertase/react-native-apple-authentication' KHÔNG crash trong Metro
// (NativeModules cổ điển, không getEnforcing) → không dùng "require fail" làm tín hiệu mock được.
// Dùng `authAvailable` (Tuya native có mặt) làm tín hiệu "đang chạy build native thật".
import { authAvailable } from './auth';

let mod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  mod = require('@invertase/react-native-apple-authentication');
} catch {
  mod = null;
}
const appleAuth: any = mod?.appleAuth ?? mod?.default ?? null;

// Sign in with Apple: iOS 13+ only. Android cần web-flow (ngoài scope M1) → NOT_SUPPORTED.
export const appleAvailable: boolean = authAvailable && appleAuth != null && appleAuth.isSupported === true;

export type AppleErrorCode = 'CANCELLED' | 'NOT_SUPPORTED' | 'NO_ID_TOKEN' | 'FAILED' | 'UNKNOWN';
export class AppleSignInError extends Error {
  code: AppleErrorCode;
  constructor(code: AppleErrorCode, message: string) {
    super(message);
    this.name = 'AppleSignInError';
    this.code = code;
  }
}

// Apple chỉ trả email/fullName LẦN ĐẦU authorize (lần sau = null) → giữ lại ngay để build extraInfo.
export type AppleCredential = {
  identityToken: string; // JWT → accessToken cho Tuya
  user: string; // userIdentifier ổn định
  email: string | null;
  fullName: string | null; // nickname (dùng cho nickname/snsNickname trong extraInfo)
};

const MOCK: AppleCredential = {
  identityToken: 'mock-apple-id-token',
  user: 'mock-apple-user',
  email: 'demo@privaterelay.appleid.com',
  fullName: 'Demo',
};

export async function signInApple(): Promise<AppleCredential> {
  if (!authAvailable) return MOCK; // Metro/dev chưa build native → chạy luồng mock

  if (appleAuth == null || appleAuth.isSupported !== true) {
    throw new AppleSignInError('NOT_SUPPORTED', 'Sign in with Apple is only available on iOS 13+.');
  }

  let res: any;
  try {
    res = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });
  } catch (e: any) {
    const code = e?.code;
    if (appleAuth.Error && code === appleAuth.Error.CANCELED) {
      throw new AppleSignInError('CANCELLED', 'Apple sign-in was cancelled.');
    }
    throw new AppleSignInError(
      appleAuth.Error && code === appleAuth.Error.FAILED ? 'FAILED' : 'UNKNOWN',
      e?.message ?? String(e),
    );
  }

  const identityToken: string | null = res?.identityToken ?? null;
  if (!identityToken) {
    throw new AppleSignInError('NO_ID_TOKEN', 'Apple did not return an identityToken.');
  }
  const nickname: string | null = res?.fullName?.nickname ?? res?.fullName?.givenName ?? null;
  return {
    identityToken,
    user: res?.user ?? '',
    email: res?.email ?? null,
    fullName: nickname,
  };
}
