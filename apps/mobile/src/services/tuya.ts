// Adapter Tuya cho app: dùng lib thật nếu native có mặt; nếu KHÔNG (Metro chưa build native)
// HOẶC bật MOCK_DEVICES (config/mock.ts) → mock có trạng thái + giả lập realtime (mockDevice.ts),
// để dev UI không cần bồn thật. Lý do require động: index.tsx của lib gọi
// TurboModuleRegistry.getEnforcing + new NativeEventEmitter NGAY lúc import → JS-only sẽ throw.
import { isMockDevId } from '../config/mock';
import {
  parseDeviceDps,
  buildTempDps,
  buildLightDps,
  buildPurifyDps,
  buildFreezeDps,
} from './dp';
import { parseTempRange, type TempRange } from './deviceSchema';
import { describeTuyaError } from './tuyaError';
import {
  mockRead,
  mockSetTarget,
  mockSetLight,
  mockSetPurify,
  mockSetFreeze,
  mockListen,
} from './mockDevice';

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
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
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
  purifyOn?: boolean; // optional: DP placeholder - thiết bị thật có thể chưa expose
  freezeOn?: boolean;
  isOnline: boolean; // LAN hoặc cloud (DeviceBean.getIsOnline)
  tempRange: TempRange; // ràng buộc target temp từ schema thiết bị
};
// Patch realtime: chỉ các field thay đổi (onDeviceStatus mang isOnline? + dpsJson?).
export type DevicePatch = {
  currentTemp?: number | null;
  targetTemp?: number | null;
  lightOn?: boolean;
  purifyOn?: boolean;
  freezeOn?: boolean;
  isOnline?: boolean;
};
export type Subscription = { remove(): void };

// require động trong try/catch (KHÔNG import tĩnh - tránh crash khi native vắng).
let lib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}

/** true khi native module Tuya có mặt (đã build native). Dev không build → false → dùng mock. */
export const tuyaAvailable: boolean = lib != null && lib.Tuya != null;

/**
 * true → thao tác thiết bị đi qua mock. CHỈ khi: native vắng (Metro-only), chưa có devId,
 * HOẶC devId là bồn GIẢ (isMockDevId). Thiết bị THẬT (dù MOCK_DEVICES bật) → false → dùng SDK.
 */
const shouldMock = (devId?: string): boolean => !tuyaAvailable || !devId || isMockDevId(devId);

// LƯU Ý: KHÔNG gate theo MOCK_DEVICES ở đây. initSdk là init SDK Tuya cho TOÀN app (login/home/pairing
// đều cần - AppDelegate/Android không init, chỉ có chỗ này). MOCK_DEVICES chỉ mock tầng ĐIỀU KHIỂN
// thiết bị (read/set/listen bên dưới), không được chặn init SDK → nếu chặn thì login getUserInstance()=null.
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
 * - mock (MOCK_DEVICES / native vắng / devId rỗng) → trả state mock (KHÔNG coi là lỗi).
 * - native có + devId có nhưng lib throw (đọc thật thất bại) → **rethrow** để caller hiện state `error`.
 */
export async function readDevice(devId: string): Promise<DeviceSnapshot> {
  if (shouldMock(devId)) return mockRead(devId);
  // timeout để không kẹt 'connecting'/loading nếu native treo (audit M-2).
  const snap = await withTimeout<any>(lib.Tuya.getDeviceSnapshot(devId), READ_TIMEOUT_MS, 'Device read');
  const d = parseDeviceDps(snap?.dpsJson ?? '{}');
  return {
    currentTemp: d.currentTemp,
    targetTemp: d.targetTemp,
    lightOn: d.lightOn ?? false,
    purifyOn: d.purifyOn ?? undefined,
    freezeOn: d.freezeOn ?? undefined,
    isOnline: snap?.isOnline ?? false,
    tempRange: parseTempRange(snap?.schemaJson ?? ''),
  };
}

/**
 * Đặt nhiệt độ mục tiêu - dùng `publishDpsAwaitAck` (resolve khi onDpUpdate khớp) để phân biệt
 * "đã gửi" vs "thiết bị đã đổi" (cạm bẫy Tuya: onSuccess ≠ đổi xong).
 * @returns `true` = thiết bị đã xác nhận (ack); `false` = không ack / lỗi → caller revert optimistic.
 * mock → cập nhật state giả + coi như confirmed ngay (`true`).
 */
export async function setTargetTemp(devId: string, temp: number): Promise<SetResult> {
  if (shouldMock(devId)) {
    mockSetTarget(devId, temp);
    return { ok: true };
  }
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

async function publishBool(
  devId: string,
  where: string,
  dpsJson: string,
  applyMock: () => void,
): Promise<SetResult> {
  if (shouldMock(devId)) {
    applyMock();
    return { ok: true };
  }
  try {
    await lib.Tuya.publishDps(devId, dpsJson);
    return { ok: true };
  } catch (e) {
    devLogError(where, e);
    return { ok: false, error: describeTuyaError(e).message };
  }
}

export const setLight = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'setLight', buildLightDps(on), () => mockSetLight(devId, on));

export const setPurify = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'setPurify', buildPurifyDps(on), () => mockSetPurify(devId, on));

export const setFreeze = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'setFreeze', buildFreezeDps(on), () => mockSetFreeze(devId, on));

/** Lắng nghe realtime DP của thiết bị (onDeviceStatus). Mock → giả lập trôi nhiệt độ. */
export function listenDevice(devId: string, onPatch: (p: DevicePatch) => void): Subscription {
  if (shouldMock(devId)) return mockListen(devId, onPatch);
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
        if (d.purifyOn != null) patch.purifyOn = d.purifyOn;
        if (d.freezeOn != null) patch.freezeOn = d.freezeOn;
      }
      // bỏ qua event rỗng (không field nào)
      if (Object.keys(patch).length === 0) return;
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
