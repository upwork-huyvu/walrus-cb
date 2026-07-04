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

export async function getCurrentWifiSsid(): Promise<string | null> {
  if (!currentWifiAvailable) return null;
  try {
    const ssid = await wifiLib.getCurrentWifiSSID();
    return cleanSsid(ssid) || null;
  } catch {
    return null;
  }
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
