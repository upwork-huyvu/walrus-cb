// Client cho màn TEST (dev) - gọi THẲNG native Tuya SDK (App SDK), KHÔNG qua Cloud/backend.
// Lấy state (getDeviceSnapshot/getDps/isOnline...) + điều khiển (publishDps) + realtime (onDeviceStatus).
//
// LƯU Ý SDK (khác Cloud):
//   - dps keyed theo dpId (số), vd {"121": true}. Raw = HEX (vd {"115":"004b0028..."}).
//   - getDeviceSnapshot trả cả dpsJson/schemaJson/dpCodesJson/rawJson (JSON string) để soi thô.
//
// require động trong try/catch (KHÔNG import tĩnh) - lib gọi TurboModuleRegistry.getEnforcing lúc
// import → JS-only (Metro chưa build native) sẽ throw. Cùng pattern services/tuya.ts.

let lib: any = null;
try {
   
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}

/** true khi native module Tuya có mặt (đã build native). */
export const sdkAvailable: boolean = lib != null && lib.Tuya != null;

export type SdkResult = { ok: boolean; result?: unknown; error?: string };
export type Subscription = { remove(): void };

async function wrap(fn: () => Promise<unknown> | unknown): Promise<SdkResult> {
  if (!sdkAvailable) {
    return { ok: false, error: 'Native SDK vắng (chưa build native / chạy Metro-only).' };
  }
  try {
    const r = await fn();
    return { ok: true, result: r === undefined ? '(void - lệnh đã gửi)' : r };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// ── Đọc state ──
export const sdkGetSnapshot = (id: string): Promise<SdkResult> =>
  wrap(() => lib.Tuya.getDeviceSnapshot(id));
export const sdkGetDps = (id: string): Promise<SdkResult> => wrap(() => lib.Tuya.getDps(id));
export const sdkIsOnline = (id: string): Promise<SdkResult> => wrap(() => lib.Tuya.isDeviceOnline(id));
export const sdkIsCloudConnected = (): Promise<SdkResult> => wrap(() => lib.Tuya.isCloudConnected());
export const sdkGetWifiSignal = (id: string): Promise<SdkResult> =>
  wrap(() => lib.Tuya.getWifiSignal(id));
/** queryDp: yêu cầu thiết bị báo lại 1 DP - kết quả về qua event onDeviceStatus (bật Listen để thấy). */
export const sdkQueryDp = (id: string, dpId: string): Promise<SdkResult> =>
  wrap(() => lib.Tuya.queryDp(id, dpId));

// ── Điều khiển ──
export const sdkPublishDps = (id: string, dpsJson: string): Promise<SdkResult> =>
  wrap(() => lib.Tuya.publishDps(id, dpsJson));
/** publishDpsAwaitAck: resolve khi thiết bị báo DP khớp (onSuccess ≠ đổi xong). timeoutMs<=0 → mặc định. */
export const sdkPublishDpsAwaitAck = (
  id: string,
  dpsJson: string,
  timeoutMs = 0,
): Promise<SdkResult> => wrap(() => lib.Tuya.publishDpsAwaitAck(id, dpsJson, timeoutMs));

// ── Realtime (onDeviceStatus) ──
export function sdkListen(id: string, onEvent: (e: unknown) => void): Subscription {
  if (!sdkAvailable) return { remove() {} };
  try {
    lib.Tuya.registerDeviceListener(id);
    const sub = lib.onDeviceStatus((e: unknown) => onEvent(e));
    return {
      remove() {
        try {
          lib.Tuya.unregisterDeviceListener(id);
          sub?.remove?.();
        } catch {
          // bỏ qua lỗi khi gỡ
        }
      },
    };
  } catch {
    return { remove() {} };
  }
}
