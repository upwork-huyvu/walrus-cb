// Log chẩn đoán pairing: ring buffer trong RAM, user copy được từ màn lỗi.
//
// Vì sao cần: pairing chạy trong native SDK, fail trên máy khách ở xa. Không có log thì mọi thất bại
// đều quy về một dòng vô nghĩa. Buffer này ghi lại: mode, ssid, băng tần, homeId, từng step của SDK,
// và raw error {code, message, domain} - đủ để chẩn đoán mà không cần cắm máy.
//
// BẢO MẬT: KHÔNG BAO GIỜ ghi password/token nguyên văn (xem SECRET_KEY). Chỉ giữ độ dài để phân biệt
// "user chưa nhập" với "nhập rồi mà sai". Log nằm hoàn toàn trong RAM, không gửi đi đâu -
// user chủ động bấm "Copy diagnostics" mới chia sẻ.
import { Platform } from 'react-native';

export type PairingLogEntry = {
  /** epoch ms */
  ts: number;
  event: string;
  data?: Record<string, unknown>;
};

const MAX_ENTRIES = 120;
const buffer: PairingLogEntry[] = [];

/** Khoá bị che hoàn toàn. Giữ length vì "rỗng" vs "sai" là 2 lỗi khác nhau. */
const SECRET_KEY = /^(password|pwd|pass|token|secret|api_?key)$/i;

export function redactValue(key: string, value: unknown): unknown {
  if (!SECRET_KEY.test(key)) return value;
  if (value == null || value === '') return '<empty>';
  return `<redacted len=${String(value).length}>`;
}

function redact(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue; // đừng làm bẩn log bằng key rỗng
    out[k] = redactValue(k, v);
  }
  return out;
}

export function logPairing(event: string, data?: Record<string, unknown>): void {
  const entry: PairingLogEntry = { ts: Date.now(), event, data: redact(data) };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[pairing] ${event}`, entry.data ?? '');
  }
}

export function clearPairingLog(): void {
  buffer.length = 0;
}

export function getPairingLog(): readonly PairingLogEntry[] {
  return buffer;
}

/** Chuỗi copy-được: header môi trường + timeline tương đối (dễ thấy chỗ nào treo lâu). */
export function dumpPairingLog(): string {
  const head = [
    'Walrus pairing diagnostics',
    `platform: ${Platform.OS} ${String(Platform.Version)}`,
    `events: ${buffer.length}`,
  ];
  const first = buffer[0];
  if (!first) return [...head, '', '(no events recorded)'].join('\n');

  const t0 = first.ts;
  const lines = buffer.map((e) => {
    const dt = String(e.ts - t0).padStart(6, ' ');
    const data = e.data && Object.keys(e.data).length > 0 ? ` ${JSON.stringify(e.data)}` : '';
    return `+${dt}ms  ${e.event}${data}`;
  });
  return [...head, '', ...lines].join('\n');
}
