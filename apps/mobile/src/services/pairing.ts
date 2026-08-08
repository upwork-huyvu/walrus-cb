// Adapter pairing: dùng lib Tuya nếu native có mặt; nếu KHÔNG → mock (simulate token/scan/pair) để
// luồng UI test được trong Metro chưa build native. Cùng pattern require try/catch như services/tuya.ts.
import { logPairing } from './pairingLog';
export type PairedDevice = {
  devId: string;
  name: string;
  productId: string;
  isOnline: boolean;
  iconUrl: string;
};
export type BleScanItem = {
  id: string;
  name: string;
  productId: string;
  uuid: string;
  mac: string;
  address: string;
  deviceType: number;
  /** Combo (Wi-Fi + BLE) → phải nhập Wi-Fi khi pair. BLE thuần → pair thẳng. Native tính (iOS bleType / Android configType). */
  isCombo?: boolean;
  bleType?: number; // iOS raw
  configType?: string; // Android raw
  providerName?: string; // Android raw
};
export type PairingProgress = {
  /** iOS: `device_found|device_registered|device_initialized|device_timeout|device_state_error`.
   *  Android: chuỗi `onStep()` nguyên văn. ⚠️ timeout/state_error là LỖI, không phải tiến trình. */
  step: string;
  dataJson?: string;
  /** iOS: SDK báo lỗi ngay trong callback tiến trình (vd thiết bị không join được Wi-Fi). */
  errorCode?: string;
  errorMessage?: string;
  errorDomain?: string;
  devId?: string;
};
export type Subscription = { remove(): void };

let lib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}
export const pairingAvailable: boolean = lib != null && lib.Tuya != null;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- Mock layer (chỉ khi native vắng) ---
const mockProgressCbs = new Set<(e: PairingProgress) => void>();
const mockBleCbs = new Set<(e: BleScanItem) => void>();
const MOCK_DEVICE: PairedDevice = {
  devId: 'mock-dev-001',
  name: 'Walrus Ice Bath',
  productId: 'mock',
  isOnline: true,
  iconUrl: '',
};
const MOCK_BLE: BleScanItem = {
  id: 'mock-ble',
  name: 'Walrus Ice Bath (BLE)',
  productId: 'mock',
  uuid: 'mock-uuid-001',
  mac: '00:11:22:33:44:55',
  address: '',
  deviceType: 0,
  isCombo: true, // giả lập thiết bị combo (Wi-Fi) → luồng nhập Wi-Fi sau khi chạm
  bleType: 4, // ThingSmartBLETypeBLEWifi
  configType: 'config_type_wifi',
};
function emitMockProgress(step: string) {
  mockProgressCbs.forEach((cb) => cb({ step }));
}

/** Step báo LỖI, không phải tiến trình → UI không được nhích checklist. */
export function isFailureStep(step: string): boolean {
  const s = step.toLowerCase();
  return s.includes('timeout') || s.includes('time_out') || s.includes('error') || s.includes('fail');
}

// iOS ThingSmartBLEType (int) cần Wi-Fi: BLEWifi(4) BLEWifiSecurity(6) BLEWifiPlugPlay(7) BLELTESecurity(9)
// BLEWifiPriorBLE(11). Bảng route từ sample chính chủ.
const COMBO_BLE_TYPES = new Set([4, 6, 7, 9, 11]);

/**
 * Thiết bị (từ BLE scan) có cần nhập Wi-Fi khi pair không (= combo Wi-Fi+BLE)?
 * Ưu tiên cờ `isCombo` native đã tính; fallback suy từ raw (iOS bleType / Android configType).
 * KHÔNG rõ → mặc định `true`: đa số thiết bị Tuya Wi-Fi là combo, và hỏi Wi-Fi thừa an toàn hơn thiếu.
 */
export function deviceNeedsWifi(item: Pick<BleScanItem, 'isCombo' | 'bleType' | 'configType'>): boolean {
  if (typeof item.isCombo === 'boolean') return item.isCombo;
  if (typeof item.bleType === 'number' && item.bleType > 0) return COMBO_BLE_TYPES.has(item.bleType);
  if (typeof item.configType === 'string' && item.configType) {
    return item.configType.toLowerCase().includes('wifi');
  }
  return true;
}

// --- Events ---
export function onPairingProgress(cb: (e: PairingProgress) => void): Subscription {
  // Bọc callback để MỌI event của SDK đều vào log chẩn đoán (kể cả khi UI bỏ qua nó).
  const wrapped = (e: PairingProgress) => {
    logPairing('sdk.step', {
      step: e.step,
      // `dataJson` là chỗ native nhét chi tiết của các step KHÔNG phải lỗi (vd
      // `sdk.security_configs_skipped` mang lý do bỏ qua) - thiếu nó thì diagnostics chỉ thấy tên
      // step trơ trọi, không truy được vì sao.
      dataJson: e.dataJson,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      errorDomain: e.errorDomain,
      devId: e.devId,
    });
    cb(e);
  };
  if (pairingAvailable) {
    return lib.onPairingProgress(wrapped);
  }
  mockProgressCbs.add(wrapped);
  return { remove: () => mockProgressCbs.delete(wrapped) };
}

export function onBleScan(cb: (e: BleScanItem) => void): Subscription {
  // Log MỌI thiết bị BLE scan thấy → diagnostics soi được scan có bắt được gì không (auto-scan trống = ?).
  const wrapped = (e: BleScanItem) => {
    logPairing('sdk.blescan', {
      uuid: e.uuid,
      mac: e.mac,
      name: e.name,
      productId: e.productId,
      bleType: e.bleType,
      isCombo: e.isCombo,
    });
    cb(e);
  };
  if (pairingAvailable) {
    return lib.onBleScan(wrapped);
  }
  mockBleCbs.add(wrapped);
  return { remove: () => mockBleCbs.delete(wrapped) };
}

// --- Home ---
// ⚠️ TẠM cho tới B5: PairingScreen sẽ nhận homeId tường minh từ Device List (đã qua home-gate),
// bỏ hẳn ensureHome. Trong lúc đó ensureHome delegate sang services/home.ts (không nhân đôi logic):
// lấy home đầu tiên; nếu chưa có thì tạo mặc định (chỉ là fallback dev, luồng chuẩn tạo home ở màn Create Home).
import { getHomeList, createHome } from './home';
export async function ensureHome(): Promise<number> {
  const list = await getHomeList();
  if (list.length > 0) return list[0].homeId;
  const h = await createHome('Walrus Home');
  return h.homeId;
}

// --- Wi-Fi (EZ/AP) auto-token ---
export async function pairWifi(
  homeId: number,
  mode: 'EZ' | 'AP',
  ssid: string,
  password: string,
  timeoutSec = 120
): Promise<PairedDevice> {
  // `password` được redact trong pairingLog (chỉ giữ độ dài) - đủ để phân biệt "quên nhập" vs "sai".
  logPairing('wifi.start', { mode, ssid, password, homeId, timeoutSec, native: pairingAvailable });
  if (!pairingAvailable) {
    emitMockProgress('device_find');
    await delay(900);
    emitMockProgress('device_bind_success');
    await delay(400);
    return MOCK_DEVICE;
  }
  try {
    const dev: PairedDevice = await lib.Tuya.startWifiPairingAuto(homeId, mode, ssid, password, timeoutSec);
    logPairing('wifi.success', { devId: dev.devId, name: dev.name, productId: dev.productId });
    return dev;
  } catch (e) {
    logPairing('wifi.error', { ...errorDetail(e) });
    throw e;
  }
}

export function stopWifi(): void {
  if (pairingAvailable) lib.Tuya.stopWifiPairing();
}

// --- BLE scan ---
export function startBleScan(timeoutSec = 60): void {
  if (!pairingAvailable) {
    setTimeout(() => mockBleCbs.forEach((cb) => cb(MOCK_BLE)), 700);
    return;
  }
  lib.Tuya.startBleScan(timeoutSec);
}

export function stopBleScan(): void {
  if (pairingAvailable) lib.Tuya.stopBleScan();
}

// --- Combo BLE+Wi-Fi (auto-token) ---
export async function pairBleWifi(
  homeId: number,
  uuid: string,
  ssid: string,
  password: string,
  timeoutSec = 120
): Promise<PairedDevice> {
  logPairing('blewifi.start', { uuid, ssid, password, homeId, timeoutSec, native: pairingAvailable });
  if (!pairingAvailable) {
    emitMockProgress('ble_connect');
    await delay(900);
    emitMockProgress('device_bind_success');
    await delay(400);
    return MOCK_DEVICE;
  }
  try {
    const dev: PairedDevice = await lib.Tuya.startBleWifiPairing(homeId, uuid, ssid, password, timeoutSec);
    logPairing('blewifi.success', { devId: dev.devId, name: dev.name });
    return dev;
  } catch (e) {
    logPairing('blewifi.error', { ...errorDetail(e) });
    throw e;
  }
}

export function stopBleWifi(uuid: string): void {
  if (pairingAvailable) lib.Tuya.stopBleWifiPairing(uuid);
}

// --- BLE thuần (không cần Wi-Fi) - cho thiết bị bleType BLE/BLEPlus/BLESecurity/... khi chạm ở luồng discovery ---
export async function pairBle(
  homeId: number,
  item: Pick<BleScanItem, 'uuid' | 'productId' | 'address' | 'deviceType'>,
  timeoutSec = 120
): Promise<PairedDevice> {
  logPairing('ble.start', { uuid: item.uuid, homeId, timeoutSec, native: pairingAvailable });
  if (!pairingAvailable) {
    emitMockProgress('ble_connect');
    await delay(900);
    emitMockProgress('device_bind_success');
    await delay(400);
    return MOCK_DEVICE;
  }
  try {
    const dev: PairedDevice = await lib.Tuya.startBlePairing(
      homeId,
      item.uuid,
      item.productId ?? '',
      item.address ?? '',
      item.deviceType ?? 0,
      timeoutSec
    );
    logPairing('ble.success', { devId: dev.devId, name: dev.name });
    return dev;
  } catch (e) {
    logPairing('ble.error', { ...errorDetail(e) });
    throw e;
  }
}

// --- Đặt tên thiết bị sau khi pair (bước confirm cuối, chuẩn SmartLife). Native vắng → no-op. ---
export async function renameDevice(devId: string, name: string): Promise<void> {
  if (!pairingAvailable) return;
  await lib.Tuya.renameDevice(devId, name);
}

// Map các "step" kỹ thuật từ onPairingProgress → nhãn kiểu SmartLife (searching→found→…).
// ⚠️ Nhánh LỖI phải đứng TRƯỚC: iOS gửi `device_timeout` (ThingActivatorStep = 4) qua đúng kênh tiến trình
// này. Bản cũ để nó rơi vào nhánh mặc định 'Pairing…' → UI báo "đang chạy" trong khi đã timeout.
export function pairingStepLabel(step: string): string {
  const s = step.toLowerCase();
  if (s.includes('timeout') || s.includes('time_out')) return 'Pairing timed out';
  if (s.includes('error') || s.includes('fail')) return 'Pairing error';
  if (s.includes('start')) return 'Starting…';
  if (s.includes('scan') || s.includes('find')) return 'Searching for device…';
  if (s.includes('found') || s.includes('discover')) return 'Device found';
  if (s.includes('ble') || s.includes('connect')) return 'Connecting to device…';
  if (s.includes('register') || s.includes('active') || s.includes('bind') && !s.includes('success'))
    return 'Registering with the cloud…';
  if (s.includes('init')) return 'Initializing…';
  if (s.includes('bind_success') || s.includes('success')) return 'Connected';
  return 'Pairing…';
}

// --- Error mô tả ---
// Native LUÔN reject theo shape { code, message, domain } (ios/Common/TuyaReject.h + common/TuyaReject.kt):
//   - code   : mã Tuya THẬT (vd '-55' = token hết hạn); chỉ là literal ('pairing_error', 'ble_scan_required')
//              khi SDK không trả mã nào.
//   - message: mô tả nguyên văn của SDK.
//   - domain : 'sdk' | 'cloud' | 'network' - nằm trong `userInfo` (cả 2 nền tảng).
//
// QUY TẮC: KHÔNG BAO GIỜ nuốt `message`. `TuyaErrors.describe()` chỉ là diễn giải THÊM, và chỉ áp dụng
// cho mã SỐ (nó tra bảng; mã phi-số luôn rơi vào category 'unknown' → "Unknown error.").
// Bug cũ: describeError() trả thẳng TuyaErrors.describe('pairing_error') → "[sdk:pairing_error] Unknown error."
// (xem dev-workflow/m1-fix-wifi-pairing/).
const NUMERIC_CODE = /^-?\d+$/;

export type TuyaErrorDetail = {
  /** mã Tuya thật, hoặc literal khi SDK không cho mã. Rỗng nếu error không có code. */
  code: string;
  domain: string;
  /** message nguyên văn từ native. Rỗng nếu không có. */
  message: string;
  /** diễn giải từ bảng TuyaErrors - CHỈ có với mã số. Đã bao gồm tiền tố "[domain:code]". */
  explain: string;
};

/** Bóc error native thành các trường rời - dùng cho log chẩn đoán + hiển thị. */
export function errorDetail(e: any): TuyaErrorDetail {
  const rawCode = e?.code ?? e?.userInfo?.code;
  const code = rawCode == null ? '' : String(rawCode).trim();
  const rawDomain = e?.userInfo?.domain;
  const domain = typeof rawDomain === 'string' && rawDomain ? rawDomain : 'sdk';
  const message = typeof e?.message === 'string' ? e.message.trim() : '';

  let explain = '';
  // Mã phi-số KHÔNG được đẩy vào classify() - đó chính là nguồn gốc "Unknown error.".
  if (NUMERIC_CODE.test(code) && lib?.TuyaErrors) {
    try {
      explain = lib.TuyaErrors.describe(code, domain);
    } catch {
      explain = '';
    }
  }
  return { code, domain, message, explain };
}

export function describeError(e: any): string {
  const { code, domain, message, explain } = errorDetail(e);
  // Ưu tiên message native - đó là thứ SDK thật sự nói. Mã lỗi gắn kèm để chẩn đoán/báo lỗi.
  if (message) return code ? `${message} [${domain}:${code}]` : message;
  // explain đã tự mang tiền tố "[domain:code]" → không nối thêm.
  if (explain) return explain;
  if (code) return `Pairing failed. [${domain}:${code}]`;
  return typeof e === 'string' && e ? e : 'Pairing failed.';
}
