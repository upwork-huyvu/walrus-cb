// Adapter Tuya cho app: dùng lib thật nếu native có mặt; nếu KHÔNG (Metro chưa build native) → mock,
// để UI clone vẫn chạy được trong dev. Lý do mock: index.tsx của lib gọi TurboModuleRegistry.getEnforcing
// + new NativeEventEmitter NGAY lúc import → JS-only sẽ throw → bắt bằng require trong try/catch.
import { parseDeviceDps, buildTempDps, buildLightDps } from './dp';
import { parseTempRange, DEFAULT_TEMP_RANGE, type TempRange } from './deviceSchema';
import { describeTuyaError } from './tuyaError';

// Log lỗi SDK ở dev (audit H-1: KHÔNG nuốt im lặng). Prod: không spam console.
function devLogError(where: string, e: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const info = describeTuyaError(e);
    // eslint-disable-next-line no-console
    console.warn(`[tuya] ${where} failed`, info.code ?? '', info.message, e);
  }
}

/** Kết quả publish có ack: ok=true đã xác nhận; ok=false kèm thông điệp lỗi (đã map) để UI hiện. */
export type SetResult = { ok: boolean; error?: string };

// Bọc promise với timeout → reject 'timeout' nếu native không phản hồi (audit M-2: tránh kẹt loading).
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout sau ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

const READ_TIMEOUT_MS = 8000;

export type DeviceSnapshot = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean;
  isOnline: boolean; // LAN hoặc cloud (DeviceBean.getIsOnline)
  tempRange: TempRange; // ràng buộc target temp từ schema thiết bị
};
// Patch realtime: chỉ các field thay đổi (onDeviceStatus mang isOnline? + dpsJson?).
export type DevicePatch = {
  currentTemp?: number | null;
  targetTemp?: number | null;
  lightOn?: boolean;
  isOnline?: boolean;
};
export type Subscription = { remove(): void };

// Giá trị mock = giữ nguyên default UI cũ (12°C hiện tại / 6°C mục tiêu / đèn tắt) + coi như online.
const MOCK: DeviceSnapshot = {
  currentTemp: 12,
  targetTemp: 6,
  lightOn: false,
  isOnline: true,
  tempRange: DEFAULT_TEMP_RANGE,
};

// require động trong try/catch (KHÔNG import tĩnh — tránh crash khi native vắng).
let lib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}

/** true khi native module Tuya có mặt (đã build native). Dev không build → false → dùng mock. */
export const tuyaAvailable: boolean = lib != null && lib.Tuya != null;

export async function initSdk(): Promise<boolean> {
  if (!tuyaAvailable) return false;
  try {
    return await lib.Tuya.initSdk();
  } catch (e) {
    devLogError('initSdk', e);
    return false;
  }
}

/**
 * Đọc snapshot DP + schema + online của thiết bị → field bồn tắm.
 * - native vắng / devId rỗng (dev/chưa pair) → trả MOCK (KHÔNG coi là lỗi, để UI clone chạy).
 * - native có + devId có nhưng lib throw (đọc thật thất bại) → **rethrow** để caller hiện state `error`.
 */
export async function readDevice(devId: string): Promise<DeviceSnapshot> {
  if (!tuyaAvailable || !devId) return { ...MOCK };
  // timeout để không kẹt 'connecting'/loading nếu native treo (audit M-2).
  const snap = await withTimeout<any>(lib.Tuya.getDeviceSnapshot(devId), READ_TIMEOUT_MS, 'Đọc thiết bị');
  const d = parseDeviceDps(snap?.dpsJson ?? '{}');
  return {
    currentTemp: d.currentTemp,
    targetTemp: d.targetTemp,
    lightOn: d.lightOn ?? false,
    isOnline: snap?.isOnline ?? false,
    tempRange: parseTempRange(snap?.schemaJson ?? ''),
  };
}

/**
 * Đặt nhiệt độ mục tiêu — dùng `publishDpsAwaitAck` (resolve khi onDpUpdate khớp) để phân biệt
 * "đã gửi" vs "thiết bị đã đổi" (cạm bẫy Tuya: onSuccess ≠ đổi xong).
 * @returns `true` = thiết bị đã xác nhận (ack); `false` = không ack / lỗi → caller revert optimistic.
 * native vắng / devId rỗng (mock) → coi như confirmed ngay (`true`).
 */
export async function setTargetTemp(devId: string, temp: number): Promise<SetResult> {
  if (!tuyaAvailable || !devId) return { ok: true };
  try {
    if (typeof lib.Tuya.publishDpsAwaitAck === 'function') {
      await lib.Tuya.publishDpsAwaitAck(devId, buildTempDps(temp), 0); // 0 → timeout mặc định native
    } else {
      await lib.Tuya.publishDps(devId, buildTempDps(temp));
    }
    return { ok: true };
  } catch (e) {
    devLogError('setTargetTemp', e);
    return { ok: false, error: describeTuyaError(e).message };
  }
}

export async function setLight(devId: string, on: boolean): Promise<SetResult> {
  if (!tuyaAvailable || !devId) return { ok: true };
  try {
    await lib.Tuya.publishDps(devId, buildLightDps(on));
    return { ok: true };
  } catch (e) {
    devLogError('setLight', e);
    return { ok: false, error: describeTuyaError(e).message };
  }
}

/** Lắng nghe realtime DP của thiết bị (onDeviceStatus). No-op khi native vắng. */
export function listenDevice(devId: string, onPatch: (p: DevicePatch) => void): Subscription {
  if (!tuyaAvailable || !devId) return { remove() {} };
  try {
    lib.Tuya.registerDeviceListener(devId);
    const sub = lib.onDeviceStatus((e: { devId: string; isOnline?: boolean; dpsJson?: string }) => {
      if (e.devId !== devId) return;
      const patch: DevicePatch = {};
      // event mang cả online/offline lẫn DP update → forward cả hai.
      if (e.isOnline != null) patch.isOnline = e.isOnline;
      if (e.dpsJson) {
        const d = parseDeviceDps(e.dpsJson);
        if (d.currentTemp != null) patch.currentTemp = d.currentTemp;
        if (d.targetTemp != null) patch.targetTemp = d.targetTemp;
        if (d.lightOn != null) patch.lightOn = d.lightOn;
      }
      // bỏ qua event rỗng (không online flag, không dps)
      if (patch.isOnline === undefined && patch.currentTemp === undefined &&
          patch.targetTemp === undefined && patch.lightOn === undefined) return;
      onPatch(patch);
    });
    return {
      remove() {
        try {
          lib.Tuya.unregisterDeviceListener(devId);
          sub?.remove?.();
        } catch (e) {
          devLogError('unregisterDeviceListener', e);
        }
      },
    };
  } catch (e) {
    devLogError('listenDevice', e);
    return { remove() {} };
  }
}
