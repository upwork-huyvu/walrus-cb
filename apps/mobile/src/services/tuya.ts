// Adapter Tuya cho app: dùng lib thật nếu native có mặt; nếu KHÔNG (Metro chưa build native)
// HOẶC bật MOCK_DEVICES (config/mock.ts) → mock có trạng thái + giả lập realtime (mockDevice.ts),
// để dev UI không cần bồn thật. Lý do require động: index.tsx của lib gọi
// TurboModuleRegistry.getEnforcing + new NativeEventEmitter NGAY lúc import → JS-only sẽ throw.
import { isMockDevId } from '../config/mock';
import {
  parseDeviceDps,
  buildTempDps,
  buildBoolDps,
  resolveDpMap,
  setDpMap,
  getDpMap,
  setDpCodes,
  getCodeById,
  resolveDpKinds,
  setDpKinds,
  getDpKinds,
  cacheRawDps,
  getRawDp,
  type DpFn,
} from './dp';
import { logDeviceSnapshot, logDeviceReadAttempt, logDpUpdate } from './deviceLog';
import { parseTempRange, type TempRange } from './deviceSchema';
import { describeTuyaError } from './tuyaError';
import { getHomeDeviceList, removeMockDevice } from './home';
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
const REMOVE_TIMEOUT_MS = 15000;

/** Chức năng nào thiết bị có DP → UI ẩn nút không tồn tại (khớp code thật của thiết bị). */
export type DeviceCaps = { power: boolean; light: boolean; purify: boolean };

export type DeviceSnapshot = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean;
  // optional = thiết bị KHÔNG có DP tương ứng (đã resolve theo code thật, không đoán nữa).
  purifyOn?: boolean;
  freezeOn?: boolean;
  powerOn?: boolean; // DP nguồn (vd setting_pwr)
  fault?: number; //    DP fault dạng bitmap; 0 = bình thường
  caps: DeviceCaps; //  DP nào thiết bị có (power/light/purify) - để ẩn nút không có
  isOnline: boolean; // LAN hoặc cloud (DeviceBean.getIsOnline)
  tempRange: TempRange; // ràng buộc target temp từ chính thiết bị
};
// Patch realtime: chỉ các field thay đổi (onDeviceStatus mang isOnline? + dpsJson?).
export type DevicePatch = {
  currentTemp?: number | null;
  targetTemp?: number | null;
  lightOn?: boolean;
  purifyOn?: boolean;
  freezeOn?: boolean;
  powerOn?: boolean;
  fault?: number;
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
  // Log TRƯỚC mọi early-return: nếu bail sang mock thì vẫn biết devId/native/lý do (khỏi tưởng log hỏng).
  logDeviceReadAttempt(devId, tuyaAvailable, isMockDevId(devId));
  if (shouldMock(devId)) return mockRead(devId);
  // timeout để không kẹt 'connecting'/loading nếu native treo (audit M-2).
  const snap = await withTimeout<any>(lib.Tuya.getDeviceSnapshot(devId), READ_TIMEOUT_MS, 'Device read');
  // Map DP theo code THẬT của thiết bị; nhớ lại để publish/realtime dùng.
  const map = resolveDpMap(snap?.dpCodesJson ?? '');
  const kinds = resolveDpKinds(map, snap?.schemaJson ?? ''); // biết DP nào kiểu raw để decode hex
  setDpMap(devId, map);
  setDpKinds(devId, kinds);
  setDpCodes(devId, snap?.dpCodesJson ?? ''); // dpId→code, để log realtime đọc được
  cacheRawDps(devId, snap?.dpsJson ?? '{}'); // giữ payload hex để ghi 1 slot mà không mất slot khác
  logDeviceSnapshot(snap, map); // in dpId/code/value/schema ra log để đối chiếu DP thật
  const d = parseDeviceDps(snap?.dpsJson ?? '{}', map, kinds);
  return {
    currentTemp: d.currentTemp,
    targetTemp: d.targetTemp,
    lightOn: d.lightOn ?? false,
    purifyOn: d.purifyOn ?? undefined,
    freezeOn: d.freezeOn ?? undefined,
    powerOn: d.powerOn ?? undefined,
    fault: d.fault ?? undefined,
    // Capability = DP nào thiết bị THẬT khai (đã resolve theo code) → UI ẩn nút không có.
    caps: { power: !!map.power, light: !!map.light, purify: !!map.purify },
    isOnline: snap?.isOnline ?? false,
    // Biên thật ưu tiên DP raw `setting_temp_range`; không có thì rơi về schema DP target.
    tempRange: parseTempRange(snap?.schemaJson ?? '', map, getRawDp(devId, map.tempRange)),
  };
}

/**
 * CHẨN ĐOÁN (dev-only): đọc snapshot + in TOÀN BỘ chi tiết 1 thiết bị (DP/schema/device model).
 * Khác `readDevice`: KHÔNG throw, không trả gì - chỉ để log. Dùng khi muốn xem DP thật mà chưa
 * cần mở màn device detail (readDevice chỉ chạy lúc vào Dashboard).
 */
export async function logDeviceDetail(devId: string): Promise<void> {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const mock = isMockDevId(devId);
  if (!tuyaAvailable || !devId || mock) {
    logDeviceReadAttempt(devId, tuyaAvailable, mock); // nói rõ vì sao không đọc được thiết bị thật
    return;
  }
  try {
    const snap = await withTimeout<any>(lib.Tuya.getDeviceSnapshot(devId), READ_TIMEOUT_MS, 'Device read');
    // Cache đủ bộ y như readDevice: log realtime sau đó mới hiện được code, và lần ghi slot đầu
    // tiên không cần chờ mở Dashboard.
    const map = resolveDpMap(snap?.dpCodesJson ?? '');
    setDpMap(devId, map);
    setDpKinds(devId, resolveDpKinds(map, snap?.schemaJson ?? ''));
    setDpCodes(devId, snap?.dpCodesJson ?? '');
    cacheRawDps(devId, snap?.dpsJson ?? '{}');
    logDeviceSnapshot(snap, map);
  } catch (e) {
    devLogError(`logDeviceDetail(${devId})`, e);
  }
}

/** Dump chi tiết nhiều thiết bị - TUẦN TỰ để log không bị đan xen; bỏ id trùng (mergePairedDevice). */
export async function logDeviceDetails(devIds: string[]): Promise<void> {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  for (const id of new Set(devIds)) await logDeviceDetail(id);
}

/**
 * Đọc online LIVE của từng thiết bị qua `isDeviceOnline` (CÙNG nguồn Dashboard dùng - model
 * per-device). Vì sao cần: màn danh sách lấy online từ SNAPSHOT của home (`home.deviceList`),
 * trên iOS bản này dễ bị cũ ⇒ list hiện OFFLINE trong khi mở máy ra lại ONLINE. Patch lại bằng
 * chính `isDeviceOnline` nên list luôn khớp trạng thái thật.
 * Trả `{devId: online}`; bỏ qua mock / native vắng / lỗi (giữ nguyên giá trị cũ của list).
 */
export async function refreshDevicesOnline(devIds: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  if (!tuyaAvailable || typeof lib.Tuya.isDeviceOnline !== 'function') return out;
  await Promise.all(
    [...new Set(devIds)].map(async (id) => {
      if (!id || isMockDevId(id)) return;
      try {
        out[id] = await withTimeout<boolean>(
          lib.Tuya.isDeviceOnline(id),
          READ_TIMEOUT_MS,
          'Device online',
        );
      } catch (e) {
        devLogError(`isDeviceOnline(${id})`, e); // không nuốt im lặng, nhưng không chặn cả list
      }
    }),
  );
  return out;
}

/**
 * Gỡ thiết bị khỏi Tuya Home/cloud của chính user đang đăng nhập. Đây là `removeDevice`, KHÔNG phải
 * factory reset. Chỉ resolve sau callback success của SDK; caller chỉ được dọn local sau đó.
 */
export async function removeDevice(devId: string): Promise<void> {
  if (!devId) throw new Error('Missing device ID.');
  if (shouldMock(devId)) {
    removeMockDevice(devId);
    return;
  }
  if (typeof lib.Tuya.removeDevice !== 'function') {
    throw new Error('This app build does not support removing devices.');
  }
  await withTimeout<void>(lib.Tuya.removeDevice(devId), REMOVE_TIMEOUT_MS, 'Device removal');
}

/**
 * Remove idempotent: SDK có thể báo `no device` sau khi thiết bị đã reset/xoá ở app khác. Chỉ coi
 * nhánh lỗi là thành công khi refetch chính Home xác nhận devId đã vắng; nếu không xác minh được thì
 * giữ lỗi gốc để caller không dọn local nhầm.
 */
export async function removeDeviceOrConfirmAbsent(devId: string, homeId?: number): Promise<void> {
  try {
    await removeDevice(devId);
  } catch (removeError) {
    if (homeId != null) {
      try {
        const current = await getHomeDeviceList(homeId);
        if (!current.some((device) => device.devId === devId)) return;
      } catch {
        // Giữ lỗi remove gốc ở dưới.
      }
    }
    throw removeError;
  }
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
  const map = getDpMap(devId);
  // DP target có thể là kiểu `raw` (mảng hex nhiều slot) → truyền payload hiện tại để ghi đè ĐÚNG 1 slot.
  const dps = buildTempDps(temp, map, getRawDp(devId, map.targetTemp), getDpKinds(devId));
  if (dps == null) {
    // Thiếu DP hoặc payload raw hỏng → KHÔNG publish (ghi bừa vào DP lạ nguy hiểm hơn là báo lỗi).
    return { ok: false, error: 'This device has no target-temperature control.' };
  }
  try {
    if (typeof lib.Tuya.publishDpsAwaitAck === 'function') {
      await lib.Tuya.publishDpsAwaitAck(devId, dps, 0); // 0 → timeout mặc định native
    } else {
      await lib.Tuya.publishDps(devId, dps);
    }
    return { ok: true };
  } catch (e) {
    devLogError('setTargetTemp', e);
    return { ok: false, error: describeTuyaError(e).message };
  }
}

async function publishBool(
  devId: string,
  fn: DpFn,
  where: string,
  on: boolean,
  applyMock: () => void,
): Promise<SetResult> {
  if (shouldMock(devId)) {
    applyMock();
    return { ok: true };
  }
  // Thiết bị không khai báo DP này → báo lỗi, TUYỆT ĐỐI không publish sang dp id đoán bừa.
  const dpsJson = buildBoolDps(fn, on, getDpMap(devId));
  if (dpsJson == null) return { ok: false, error: `This device has no ${fn} control.` };
  try {
    await lib.Tuya.publishDps(devId, dpsJson);
    return { ok: true };
  } catch (e) {
    devLogError(where, e);
    return { ok: false, error: describeTuyaError(e).message };
  }
}

// Dùng map ĐÃ RESOLVE của thiết bị (readDevice set). Chưa đọc snapshot ⇒ map rỗng ⇒ từ chối publish.
export const setLight = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'light', 'setLight', on, () => mockSetLight(devId, on));

export const setPurify = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'purify', 'setPurify', on, () => mockSetPurify(devId, on));

export const setFreeze = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'freeze', 'setFreeze', on, () => mockSetFreeze(devId, on));

/** Công tắc nguồn thiết bị (vd DP `setting_pwr`). Mock chưa có khái niệm nguồn → coi như ok. */
export const setPower = (devId: string, on: boolean): Promise<SetResult> =>
  publishBool(devId, 'power', 'setPower', on, () => {});

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
        // Log MỌI DP đổi kèm code: đây là cách duy nhất chốt nghĩa các DP custom (setting_clr,
        // setting_4…) và vị trí slot của setting_temp - thao tác trên Smart Life rồi đọc log.
        logDpUpdate(devId, e.dpsJson, getCodeById(devId));
        cacheRawDps(devId, e.dpsJson); // payload hex mới nhất, cho lần ghi slot kế tiếp
        const d = parseDeviceDps(e.dpsJson, getDpMap(devId), getDpKinds(devId));
        if (d.currentTemp != null) patch.currentTemp = d.currentTemp;
        if (d.targetTemp != null) patch.targetTemp = d.targetTemp;
        if (d.lightOn != null) patch.lightOn = d.lightOn;
        if (d.purifyOn != null) patch.purifyOn = d.purifyOn;
        if (d.freezeOn != null) patch.freezeOn = d.freezeOn;
        if (d.powerOn != null) patch.powerOn = d.powerOn;
        if (d.fault != null) patch.fault = d.fault;
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
