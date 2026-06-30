// Adapter Tuya cho app: dùng lib thật nếu native có mặt; nếu KHÔNG (Metro chưa build native) → mock,
// để UI clone vẫn chạy được trong dev. Lý do mock: index.tsx của lib gọi TurboModuleRegistry.getEnforcing
// + new NativeEventEmitter NGAY lúc import → JS-only sẽ throw → bắt bằng require trong try/catch.
import { parseDeviceDps, buildTempDps, buildLightDps } from './dp';
import { parseTempRange, DEFAULT_TEMP_RANGE, type TempRange } from './deviceSchema';

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
  } catch {
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
  const snap = await lib.Tuya.getDeviceSnapshot(devId);
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
export async function setTargetTemp(devId: string, temp: number): Promise<boolean> {
  if (!tuyaAvailable || !devId) return true;
  try {
    if (typeof lib.Tuya.publishDpsAwaitAck === 'function') {
      await lib.Tuya.publishDpsAwaitAck(devId, buildTempDps(temp), 0); // 0 → timeout mặc định native
    } else {
      await lib.Tuya.publishDps(devId, buildTempDps(temp));
    }
    return true;
  } catch {
    return false;
  }
}

export async function setLight(devId: string, on: boolean): Promise<void> {
  if (!tuyaAvailable || !devId) return;
  try {
    await lib.Tuya.publishDps(devId, buildLightDps(on));
  } catch {
    /* nuốt — UI đã optimistic */
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
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return { remove() {} };
  }
}
