// Wrapper mỏng quanh `TuyaErrors` của lib (classify/describe - bảng tĩnh JS-only, message + cờ retryable).
// Mục tiêu (audit H-1): KHÔNG nuốt lỗi SDK; trích mã lỗi + cho thông điệp NGƯỜI DÙNG phân biệt (sai region/owner/
// token/offline) thay vì chuỗi cố định. KHÔNG import tĩnh từ lib (index.tsx gọi getEnforcing khi import → crash
// JS-only) → lấy `TuyaErrors` qua require try/catch như adapter; dev (native vắng) → fallback message thô.
//
// QUY TẮC (giống `services/pairing.ts`): bảng `TuyaErrors` CHỈ tra được mã SỐ. Mã phi-số luôn rơi vào
// category 'unknown' → "Unknown error." và nuốt mất message thật ⇒ phải chặn trước bằng `NUMERIC_CODE`.
type TuyaDomain = 'sdk' | 'cloud' | 'network';

export type Classifier = {
  describe: (code: string | number, domain?: TuyaDomain) => string;
  classify: (code: string | number, domain?: TuyaDomain) => { retryable: boolean };
};

export type TuyaErrInfo = { code?: string; message: string; retryable: boolean };

const FALLBACK = 'Unable to reach the device. Please try again.';

/** Chỉ mã SỐ mới được đẩy vào bảng `TuyaErrors` (mã Tuya thật: -60, -1400, -10001, 1004...). */
const NUMERIC_CODE = /^-?\d+$/;

/**
 * Mã PHI-SỐ do CHÍNH bridge sinh ra (ios/*.mm + android/**.kt), không nằm trong bảng mã Tuya.
 * Message native đi kèm đang là tiếng Việt còn UI app là tiếng Anh ⇒ map sang câu tiếng Anh ở đây;
 * mã lạ (không có trong bảng) vẫn dùng message nguyên văn của native - thà lộn ngôn ngữ còn hơn nuốt lỗi.
 *
 * `retryable`: thử lại có cơ may khác kết quả không (cache SDK chưa warm, thiết bị chưa trả lời...)
 * → `services/deviceConnect.ts` dựa vào cờ này để quyết định backoff.
 */
const LITERAL: Record<string, { message: string; retryable: boolean }> = {
  // Cache thiết bị/home của SDK chưa nạp xong (hay gặp NGAY SAU KHI PAIR - xem
  // dev-workflow/m1-fix-device-connect-error/). Đợi + nạp home data là hết.
  no_device: { message: 'This device is not ready yet. Please try again in a moment.', retryable: true },
  no_home: { message: 'Your home data has not finished loading. Please try again in a moment.', retryable: true },
  // Native không trả lời trong hạn (withTimeout ở services/tuya.ts).
  timeout: { message: 'The device did not respond in time. Please try again.', retryable: true },
  ack_timeout: { message: 'The device did not confirm the change. Please try again.', retryable: true },
  snapshot_error: { message: 'Could not read this device. Please try again.', retryable: true },
  get_dps_error: { message: 'Could not read this device. Please try again.', retryable: true },
  publish_dps_error: { message: 'The device rejected the command. Please try again.', retryable: true },
  home_detail_error: { message: 'Could not load your home. Check your connection and try again.', retryable: true },
  home_device_list_error: { message: 'Could not load your devices. Check your connection and try again.', retryable: true },
  // Không retry được: phải sửa build / đăng nhập lại.
  init_error: { message: 'The Tuya SDK failed to start. Please restart the app.', retryable: false },
  no_user: { message: 'You are signed out. Please sign in again.', retryable: false },
  ios_todo: { message: 'This app build does not support that action yet.', retryable: false },
  not_implemented: { message: 'This app build does not support that action yet.', retryable: false },
};

// Mã lỗi SDK Tuya luôn ÂM (-60, -1400, -10001) → chỉ cào dạng có dấu trừ từ message.
// Vì sao KHÔNG cào số dương: message bình thường cũng đầy số ("... timed out after 8000ms") ⇒ trước đây
// bị hiểu thành mã lỗi `8000` ⇒ tra bảng không ra ⇒ "Unknown error." (chính là bug khách báo).
const NEGATIVE_CODE_IN_TEXT = /(?:^|[^\d-])(-\d{2,6})(?!\d)/;

function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message.trim();
  if (typeof e === 'string') return e.trim();
  if (e && typeof e === 'object') {
    const m = (e as Record<string, unknown>).message;
    if (typeof m === 'string') return m.trim();
  }
  return '';
}

// Native reject theo shape { code, message, domain } (TuyaReject). Trích code từ nhiều dạng để chắc.
export function extractCode(e: unknown): string | undefined {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (typeof o.code === 'string' && o.code.trim()) return o.code.trim();
    if (typeof o.code === 'number') return String(o.code);
    const ui = o.userInfo as Record<string, unknown> | undefined;
    if (ui && (typeof ui.code === 'string' || typeof ui.code === 'number')) return String(ui.code);
  }
  const m = rawMessage(e).match(NEGATIVE_CODE_IN_TEXT);
  return m ? m[1] : undefined;
}

export function extractDomain(e: unknown): TuyaDomain {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (o.domain === 'cloud' || o.domain === 'network' || o.domain === 'sdk') return o.domain;
    const ui = o.userInfo as Record<string, unknown> | undefined;
    if (ui && (ui.domain === 'cloud' || ui.domain === 'network' || ui.domain === 'sdk')) return ui.domain;
  }
  return 'sdk';
}

// describe() của lib trả "[domain:code] text" (cho log) → bỏ tiền tố để hiện cho người dùng.
function stripPrefix(s: string): string {
  return s.replace(/^\[[^\]]*\]\s*/, '');
}

let libClassifier: Classifier | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  libClassifier = require('@jimmy-vu/react-native-turbo-tuya').TuyaErrors ?? null;
} catch {
  libClassifier = null;
}

/**
 * Phân loại lỗi Tuya → { code, message (đã phân biệt), retryable }.
 * Thứ tự: mã SỐ → bảng `TuyaErrors` · mã PHI-SỐ đã biết → bảng `LITERAL` · còn lại → message native.
 * @param opts.classifier inject để test; mặc định dùng `TuyaErrors` của lib (null khi native vắng → fallback).
 */
export function describeTuyaError(
  e: unknown,
  opts?: { fallback?: string; classifier?: Classifier | null }
): TuyaErrInfo {
  const classifier = opts && 'classifier' in opts ? opts.classifier : libClassifier;
  const fallback = opts?.fallback ?? FALLBACK;
  const code = extractCode(e);
  const raw = rawMessage(e);

  if (code && NUMERIC_CODE.test(code) && classifier) {
    const domain = extractDomain(e);
    const described = stripPrefix(classifier.describe(code, domain));
    // Mã SỐ nhưng bảng không biết → describe() vẫn trả "Unknown error.". Có message native thì dùng
    // message native (nó nói đúng chuyện gì xảy ra), đừng hiện chuỗi rỗng nghĩa cho người dùng.
    const unknown = /^unknown error/i.test(described);
    return {
      code,
      message: unknown && raw ? raw : described,
      retryable: classifier.classify(code, domain).retryable,
    };
  }

  const literal = code ? LITERAL[code] : undefined;
  if (literal) return { code, message: literal.message, retryable: literal.retryable };

  return { code, message: raw || fallback, retryable: false };
}

/** Thử lại có cơ may khác kết quả không? Dùng cho backoff ở `services/deviceConnect.ts`. */
export function isRetryableTuyaError(e: unknown): boolean {
  return describeTuyaError(e).retryable;
}
