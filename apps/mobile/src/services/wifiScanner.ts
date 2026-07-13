import { PermissionsAndroid, Platform } from 'react-native';

export type ScannedWifi = {
  ssid: string;
  bssid: string;
  level: number;
  frequency: number;
};

let wifiLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  wifiLib = require('react-native-wifi-reborn').default;
} catch {
  wifiLib = null;
}

export const wifiScanAvailable = Platform.OS === 'android' && wifiLib != null;
export const currentWifiAvailable = (Platform.OS === 'android' || Platform.OS === 'ios') && wifiLib != null;
/** ⚠️ `getFrequency()` của react-native-wifi-reborn là **Android only** (xem lib/types/index.d.ts,
 *  vùng "#region Android only"). Trên iOS KHÔNG có cách nào đọc băng tần → chỉ cảnh báo được. */
export const wifiBandAvailable = Platform.OS === 'android' && wifiLib != null;

export type WifiBand = '2.4GHz' | '5GHz' | '6GHz' | 'unknown';

/** Băng tần theo tần số (MHz). Wi-Fi EZ của Tuya chỉ chạy trên 2.4GHz. */
export function bandOfFrequency(mhz: number): WifiBand {
  if (mhz >= 2400 && mhz < 2500) return '2.4GHz';
  if (mhz >= 4900 && mhz < 5900) return '5GHz';
  if (mhz >= 5925 && mhz <= 7125) return '6GHz';
  return 'unknown';
}

/** Băng tần của mạng ĐANG kết nối. iOS / lib vắng → `unknown` (không đoán bừa). */
export async function getCurrentWifiBand(): Promise<{ band: WifiBand; frequency: number }> {
  if (!wifiBandAvailable) return { band: 'unknown', frequency: 0 };
  try {
    const frequency = Number(await wifiLib.getFrequency());
    if (!Number.isFinite(frequency) || frequency <= 0) return { band: 'unknown', frequency: 0 };
    return { band: bandOfFrequency(frequency), frequency };
  } catch {
    return { band: 'unknown', frequency: 0 };
  }
}

async function ensureAndroidLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) return true;
  const granted = await PermissionsAndroid.request(permission, {
    title: 'Location permission is required for Wi-Fi scan',
    message: 'Walrus uses nearby Wi-Fi names only to help you choose the network for pairing.',
    buttonNegative: 'Not now',
    buttonPositive: 'Allow',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function cleanSsid(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '(hidden SSID)') return '';
  return trimmed;
}

export async function scanWifiNetworks(): Promise<ScannedWifi[]> {
  if (!wifiScanAvailable) return [];
  const hasPermission = await ensureAndroidLocationPermission();
  if (!hasPermission) throw new Error('Location permission is needed to scan Wi-Fi networks.');
  const entries = await wifiLib.reScanAndLoadWifiList();
  const bySsid = new Map<string, ScannedWifi>();
  for (const entry of entries ?? []) {
    const ssid = cleanSsid(entry?.SSID);
    if (!ssid) continue;
    const item: ScannedWifi = {
      ssid,
      bssid: typeof entry?.BSSID === 'string' ? entry.BSSID : '',
      level: Number(entry?.level ?? -100),
      frequency: Number(entry?.frequency ?? 0),
    };
    const prev = bySsid.get(ssid);
    if (!prev || item.level > prev.level) bySsid.set(ssid, item);
  }
  return [...bySsid.values()].sort((a, b) => b.level - a.level);
}

// Kết quả detect SSID hiện tại - có lý do để UI hiện message đúng (denied/simulator/không đọc được).
export type CurrentWifiResult =
  | { ok: true; ssid: string }
  | { ok: false; reason: 'unsupported' | 'permission' | 'not-found' | 'error'; message: string };

// Đọc SSID wifi đang kết nối. iOS: native tự bật prompt xin quyền Location khi chưa hỏi (notDetermined),
// nên gọi hàm này = vừa xin quyền vừa đọc. Trả reason để phân biệt: chưa cấp quyền vs máy không đọc được
// (điển hình: iOS Simulator luôn nil vì không có wifi hardware).
export async function detectCurrentWifi(): Promise<CurrentWifiResult> {
  if (!currentWifiAvailable) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        Platform.OS === 'ios'
          ? 'Wi-Fi name detection needs a real device (not the simulator). Enter it manually.'
          : 'Wi-Fi detection is not available on this device. Enter it manually.',
    };
  }
  try {
    const ssid = cleanSsid(await wifiLib.getCurrentWifiSSID());
    if (ssid) return { ok: true, ssid };
    return {
      ok: false,
      reason: 'not-found',
      message:
        Platform.OS === 'ios'
          ? 'Could not read the Wi-Fi name (simulator or hidden network?). Enter it manually.'
          : 'Could not read the current Wi-Fi name. Enter it manually.',
    };
  } catch (e: any) {
    const code = String(e?.code ?? e?.message ?? e);
    if (code.includes('LocationPermission')) {
      return {
        ok: false,
        reason: 'permission',
        message: 'Allow Location to auto-fill the Wi-Fi name (Settings → Privacy → Location Services).',
      };
    }
    return { ok: false, reason: 'error', message: 'Could not detect the Wi-Fi network. Enter it manually.' };
  }
}

// Phiên bản "im lặng" cho prefill lúc mở màn: chỉ lấy SSID nếu đọc được, lỗi/không có → null (không báo).
export async function getCurrentWifiSsid(): Promise<string | null> {
  const res = await detectCurrentWifi();
  return res.ok ? res.ssid : null;
}

export function describeWifiScanError(e: any): string {
  const code = e?.code ?? e?.message ?? String(e);
  if (String(code).includes('locationServicesOff')) {
    return 'Turn on Location Services, then scan again.';
  }
  if (String(code).includes('locationPermissionMissing')) {
    return 'Allow location permission to scan Wi-Fi networks.';
  }
  return e?.message ?? 'Could not scan Wi-Fi networks.';
}
