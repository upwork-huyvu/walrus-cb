// Mốc "đã đọc" thông báo (local, AsyncStorage). Dùng cho FCM: noti mới hơn mốc này = chưa đọc.
// Mở màn Notifications → set = now → badge FCM về 0. (Tuya tự có hasNotRead riêng.)
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'walrus.notif.lastReadAt.v1';

export async function getLastReadAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function setLastReadNow(now: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(now));
  } catch {
    /* no-op */
  }
}
