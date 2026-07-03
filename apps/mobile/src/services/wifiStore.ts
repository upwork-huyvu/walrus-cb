// Nhớ Wi-Fi credentials user đã nhập ở màn pairing (LOCAL — AsyncStorage, theo yêu cầu user).
// Lưu ý: AsyncStorage không mã hoá; đủ cho M1 (chỉ trên máy user, không sync/không gửi đi đâu).
// Pattern try/catch như deviceStore: native vắng → no-op, không crash.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'walrus.wifi';

export type SavedWifi = { ssid: string; password: string };

export async function getSavedWifi(): Promise<SavedWifi | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ssid !== 'string') return null;
    return { ssid: parsed.ssid, password: typeof parsed.password === 'string' ? parsed.password : '' };
  } catch {
    return null;
  }
}

export async function saveWifi(ssid: string, password: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ssid, password }));
  } catch {
    /* no-op — lần sau user gõ lại, không sao */
  }
}
