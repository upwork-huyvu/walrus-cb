// Read-state thông báo THEO USER + THEO TỪNG MESSAGE (m1-fix-notifications B3).
// Trước đây: 1 timestamp `lastReadAt` GLOBAL (không per-user, giòn vì phụ thuộc parse ts) → thay bằng
// TẬP id đã đọc, key theo uid. Một noti = đã đọc ⟺ id nằm trong tập. Không còn dựa `ts > lastReadAt`.
//   - per-user: đổi tài khoản cùng máy không lẫn read-state.
//   - per-message: bền, không phụ thuộc parse thời gian (Hermes).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifDiag } from './notifDiag'; // B1 DIAGNOSTIC - gỡ sau khi chốt persist

const PREFIX = 'walrus.notif.read.';
const CAP = 500; // giữ tối đa 500 id đọc gần nhất (list chỉ ~100 item → thừa sức, tránh phình vô hạn)

const keyFor = (uid: string): string => `${PREFIX}${uid || 'anon'}.v2`;

export type ReadState = {
  ids: Set<string>;
  /** key v2 đã tồn tại chưa - dùng cho migration "lần đầu coi mọi noti = đã đọc". */
  initialized: boolean;
};

export async function getReadState(uid: string): Promise<ReadState> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if (raw == null) return { ids: new Set(), initialized: false };
    const arr = JSON.parse(raw) as unknown;
    const ids = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
    return { ids: new Set(ids), initialized: true };
  } catch (e) {
    notifDiag('getReadState.ERROR', { err: String(e) }); // B1
    return { ids: new Set(), initialized: false };
  }
}

/** Đánh dấu các id là ĐÃ ĐỌC (merge vào tập, cap CAP giữ mới nhất). Ghi cả khi ids rỗng để khởi tạo key. */
export async function markRead(uid: string, ids: string[]): Promise<void> {
  try {
    const cur = await AsyncStorage.getItem(keyFor(uid));
    const prev: string[] = cur ? ((JSON.parse(cur) as string[]) ?? []) : [];
    // giữ thứ tự chèn, unique, cap → giữ id MỚI nhất (cuối mảng).
    const merged = [...prev.filter((id) => !ids.includes(id)), ...ids].slice(-CAP);
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify(merged));
    // B1 DIAGNOSTIC: đọc lại xác nhận persist (#2 nghi AsyncStorage không lưu được).
    const readBack = await AsyncStorage.getItem(keyFor(uid));
    notifDiag('markRead', {
      uid,
      added: ids.length,
      total: merged.length,
      persistOk: readBack != null && JSON.parse(readBack).length === merged.length,
    });
  } catch (e) {
    notifDiag('markRead.ERROR', { err: String(e) }); // B1
  }
}
