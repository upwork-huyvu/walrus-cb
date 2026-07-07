// Wrapper mỏng quanh `TuyaErrors` của lib (classify/describe - bảng tĩnh JS-only, message tiếng Việt + cờ retryable).
// Mục tiêu (audit H-1): KHÔNG nuốt lỗi SDK; trích mã lỗi + cho thông điệp NGƯỜI DÙNG phân biệt (sai region/owner/
// token/offline) thay vì chuỗi cố định. KHÔNG import tĩnh từ lib (index.tsx gọi getEnforcing khi import → crash
// JS-only) → lấy `TuyaErrors` qua require try/catch như adapter; dev (native vắng) → fallback message thô.
type TuyaDomain = 'sdk' | 'cloud' | 'network';

export type Classifier = {
  describe: (code: string | number, domain?: TuyaDomain) => string;
  classify: (code: string | number, domain?: TuyaDomain) => { retryable: boolean };
};

export type TuyaErrInfo = { code?: string; message: string; retryable: boolean };

const FALLBACK = 'Unable to reach the device. Please try again.';

let libClassifier: Classifier | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  libClassifier = require('@jimmy-vu/react-native-turbo-tuya').TuyaErrors ?? null;
} catch {
  libClassifier = null;
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
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  const m = msg.match(/-?\d{1,6}/);
  return m ? m[0] : undefined;
}

export function extractDomain(e: unknown): TuyaDomain {
  if (e && typeof e === 'object') {
    const d = (e as Record<string, unknown>).domain;
    if (d === 'cloud' || d === 'network' || d === 'sdk') return d;
  }
  return 'sdk';
}

// describe() của lib trả "[domain:code] text" (cho log) → bỏ tiền tố để hiện cho người dùng.
function stripPrefix(s: string): string {
  return s.replace(/^\[[^\]]*\]\s*/, '');
}

/**
 * Phân loại lỗi Tuya → { code, message (tiếng Việt, đã phân biệt), retryable }.
 * @param opts.classifier inject để test; mặc định dùng `TuyaErrors` của lib (null khi native vắng → fallback).
 */
export function describeTuyaError(
  e: unknown,
  opts?: { fallback?: string; classifier?: Classifier | null }
): TuyaErrInfo {
  const classifier = opts && 'classifier' in opts ? opts.classifier : libClassifier;
  const fallback = opts?.fallback ?? FALLBACK;
  const code = extractCode(e);
  if (code && classifier) {
    const domain = extractDomain(e);
    return {
      code,
      message: stripPrefix(classifier.describe(code, domain)),
      retryable: classifier.classify(code, domain).retryable,
    };
  }
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return { code, message: raw || fallback, retryable: false };
}
