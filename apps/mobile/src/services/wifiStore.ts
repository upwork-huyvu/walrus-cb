// Nhớ Wi-Fi credentials user đã nhập ở màn pairing (LOCAL — AsyncStorage, theo yêu cầu user).
// Lưu ý: AsyncStorage không mã hoá; đủ cho M1 (chỉ trên máy user, không sync/không gửi đi đâu).
// Pattern try/catch như deviceStore: native vắng → no-op, không crash.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'walrus.wifi';
const MAX_SAVED = 5;

export type SavedWifi = { ssid: string; password: string; updatedAt?: number };

function normalize(raw: unknown): SavedWifi[] {
  const items = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const out: SavedWifi[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item == null) continue;
    const record = item as Record<string, unknown>;
    const ssid = typeof record.ssid === 'string' ? record.ssid.trim() : '';
    if (!ssid || seen.has(ssid)) continue;
    seen.add(ssid);
    out.push({
      ssid,
      password: typeof record.password === 'string' ? record.password : '',
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
    });
  }
  return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, MAX_SAVED);
}

export async function getSavedWifiList(): Promise<SavedWifi[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function getSavedWifi(): Promise<SavedWifi | null> {
  const [first] = await getSavedWifiList();
  return first ?? null;
}

export async function saveWifi(ssid: string, password: string): Promise<void> {
  const clean = ssid.trim();
  if (!clean) return;
  try {
    const current = await getSavedWifiList();
    const next = [
      { ssid: clean, password, updatedAt: Date.now() },
      ...current.filter((item) => item.ssid !== clean),
    ].slice(0, MAX_SAVED);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* no-op — lần sau user gõ lại, không sao */
  }
}
