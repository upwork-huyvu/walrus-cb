// Nhớ ngày thay filter gần nhất (LOCAL - AsyncStorage). FAQ: thay mỗi 90 ngày,
// app nhắc khi còn 7 ngày. Pattern try/catch như deviceStore: native vắng → no-op.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'walrus.filterChangedAt';

export const FILTER_INTERVAL_DAYS = 90;
export const FILTER_WARN_DAYS = 7;

/** Epoch ms lần thay filter gần nhất; null = chưa ghi nhận. */
export async function getFilterChangedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function markFilterChanged(now = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(now));
  } catch {
    /* no-op */
  }
}

/** Số ngày còn lại tới hạn thay (âm = quá hạn). */
export function daysLeft(changedAt: number, now = Date.now()): number {
  const elapsed = Math.floor((now - changedAt) / 86_400_000);
  return FILTER_INTERVAL_DAYS - elapsed;
}
