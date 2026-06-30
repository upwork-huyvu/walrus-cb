// Adapter Tuya cho app: dùng lib thật nếu native có mặt; nếu KHÔNG (Metro chưa build native) → mock,
// để UI clone vẫn chạy được trong dev. Lý do mock: index.tsx của lib gọi TurboModuleRegistry.getEnforcing
// + new NativeEventEmitter NGAY lúc import → JS-only sẽ throw → bắt bằng require trong try/catch.
import { parseDeviceDps, buildTempDps, buildLightDps } from './dp';

export type DeviceSnapshot = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean;
};
export type DevicePatch = Partial<DeviceSnapshot>;
export type Subscription = { remove(): void };

// Giá trị mock = giữ nguyên default UI cũ (12°C hiện tại / 6°C mục tiêu / đèn tắt).
const MOCK: DeviceSnapshot = { currentTemp: 12, targetTemp: 6, lightOn: false };

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

/** Đọc snapshot DP của thiết bị → field bồn tắm. Mock khi native vắng / devId rỗng. */
export async function readDevice(devId: string): Promise<DeviceSnapshot> {
  if (!tuyaAvailable || !devId) return { ...MOCK };
  try {
    const snap = await lib.Tuya.getDeviceSnapshot(devId);
    const d = parseDeviceDps(snap?.dpsJson ?? '{}');
    return {
      currentTemp: d.currentTemp,
      targetTemp: d.targetTemp,
      lightOn: d.lightOn ?? false,
    };
  } catch {
    return { ...MOCK };
  }
}

export async function setTargetTemp(devId: string, temp: number): Promise<void> {
  if (!tuyaAvailable || !devId) return;
  try {
    await lib.Tuya.publishDps(devId, buildTempDps(temp));
  } catch {
    /* surface qua reject ở caller nếu cần; ở đây optimistic-UI nên nuốt */
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
    const sub = lib.onDeviceStatus((e: { devId: string; dpsJson?: string }) => {
      if (e.devId !== devId || !e.dpsJson) return;
      const d = parseDeviceDps(e.dpsJson);
      const patch: DevicePatch = {};
      if (d.currentTemp != null) patch.currentTemp = d.currentTemp;
      if (d.targetTemp != null) patch.targetTemp = d.targetTemp;
      if (d.lightOn != null) patch.lightOn = d.lightOn;
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
