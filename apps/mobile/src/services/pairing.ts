// Adapter pairing: dùng lib Tuya nếu native có mặt; nếu KHÔNG → mock (simulate token/scan/pair) để
// luồng UI test được trong Metro chưa build native. Cùng pattern require try/catch như services/tuya.ts.
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
};
export type PairingProgress = { step: string; dataJson?: string };
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
};
function emitMockProgress(step: string) {
  mockProgressCbs.forEach((cb) => cb({ step }));
}

// --- Events ---
export function onPairingProgress(cb: (e: PairingProgress) => void): Subscription {
  if (pairingAvailable) {
    return lib.onPairingProgress(cb);
  }
  mockProgressCbs.add(cb);
  return { remove: () => mockProgressCbs.delete(cb) };
}

export function onBleScan(cb: (e: BleScanItem) => void): Subscription {
  if (pairingAvailable) {
    return lib.onBleScan(cb);
  }
  mockBleCbs.add(cb);
  return { remove: () => mockBleCbs.delete(cb) };
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
  if (!pairingAvailable) {
    emitMockProgress('device_find');
    await delay(900);
    emitMockProgress('device_bind_success');
    await delay(400);
    return MOCK_DEVICE;
  }
  return lib.Tuya.startWifiPairingAuto(homeId, mode, ssid, password, timeoutSec);
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
  if (!pairingAvailable) {
    emitMockProgress('ble_connect');
    await delay(900);
    emitMockProgress('device_bind_success');
    await delay(400);
    return MOCK_DEVICE;
  }
  return lib.Tuya.startBleWifiPairing(homeId, uuid, ssid, password, timeoutSec);
}

export function stopBleWifi(uuid: string): void {
  if (pairingAvailable) lib.Tuya.stopBleWifiPairing(uuid);
}

// --- Đặt tên thiết bị sau khi pair (bước confirm cuối, chuẩn SmartLife). Native vắng → no-op. ---
export async function renameDevice(devId: string, name: string): Promise<void> {
  if (!pairingAvailable) return;
  await lib.Tuya.renameDevice(devId, name);
}

// Map các "step" kỹ thuật từ onPairingProgress → nhãn tiếng Việt kiểu SmartLife (searching→found→…).
export function pairingStepLabel(step: string): string {
  const s = step.toLowerCase();
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

// --- Error mô tả (dùng TuyaErrors của lib nếu có) ---
export function describeError(e: any): string {
  const code = e?.code ?? e?.userInfo?.code;
  if (pairingAvailable && lib.TuyaErrors && code != null) {
    try {
      return lib.TuyaErrors.describe(code);
    } catch {
      /* fallthrough */
    }
  }
  return e?.message ?? String(e);
}
