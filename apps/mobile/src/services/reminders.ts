// Client backend cho reminder bảo trì thiết bị - PER-DEVICE (mỗi thiết bị có đầu lọc riêng).
// Gọi /reminders/:deviceId kèm x-api-key (PUSH_API_KEY) + x-tuya-uid (auth MVP - xem
// docs/research/tuya-app-session-verification.md). Mock LOCAL (persist per-device qua AsyncStorage)
// khi: backend chưa cấu hình key HOẶC là bồn GIẢ.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, PUSH_API_KEY } from '../config/api';
import { isMockDevId } from '../config/mock';

export type ReminderStage = 'ok' | 'warn' | 'soon' | 'overdue';

export type Reminder = {
  deviceId: string;
  intervalDays: number;
  lastReplacedAt: string; // ISO
  enabled: boolean;
  daysRemaining: number;
  stage: ReminderStage;
};

export type ReminderInput = { intervalDays?: number; enabled?: boolean };

// Dùng mock LOCAL khi: (a) backend chưa cấu hình key, HOẶC (b) là bồn GIẢ - bồn giả không có trên
// Tuya Cloud nên DeviceOwnershipGuard ở backend chắc chắn chặn (403); phải mock để UI chạy được.
const mockLocally = (deviceId: string): boolean => !PUSH_API_KEY || isMockDevId(deviceId);

function stageOf(daysRemaining: number): ReminderStage {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 7) return 'soon';
  if (daysRemaining <= 21) return 'warn';
  return 'ok';
}

// ---------- Mock local (dev / bồn giả) - PER-DEVICE, persist qua AsyncStorage ----------
// Mỗi deviceId có ô RIÊNG: đổi lọc bồn A không ảnh hưởng bồn B. Chưa track → null (opt-in riêng
// từng bồn, khớp đúng backend thật). Lưu AsyncStorage để không mất khi restart app.
const MOCK_KEY = 'walrus.reminders.mock.v1';
const PENDING_DELETE_KEY = 'walrus.reminders.pending-deletes.v1';
const DEFAULT_INTERVAL = 90;
type MockState = { lastReplacedAt: number; intervalDays: number; enabled: boolean };
type PendingDelete = { deviceId: string; uid: string };
const mockStore = new Map<string, MockState>();

// Nạp state đã lưu (1 lần). Mọi thao tác mock await `mockReady` để không đọc trước khi nạp xong.
const mockReady: Promise<void> = (async () => {
  try {
    const raw = await AsyncStorage.getItem(MOCK_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, MockState>;
      for (const [k, v] of Object.entries(obj)) mockStore.set(k, v);
    }
  } catch {
    /* no-op */
  }
})();

async function mockPersist(): Promise<void> {
  try {
    await AsyncStorage.setItem(MOCK_KEY, JSON.stringify(Object.fromEntries(mockStore)));
  } catch {
    /* no-op */
  }
}

function newMockState(): MockState {
  return { lastReplacedAt: Date.now(), intervalDays: DEFAULT_INTERVAL, enabled: true };
}

function mockViewOf(deviceId: string, s: MockState): Reminder {
  const elapsed = Math.floor((Date.now() - s.lastReplacedAt) / 86_400_000);
  const daysRemaining = s.intervalDays - elapsed;
  return {
    deviceId,
    intervalDays: s.intervalDays,
    lastReplacedAt: new Date(s.lastReplacedAt).toISOString(),
    enabled: s.enabled,
    daysRemaining,
    stage: stageOf(daysRemaining),
  };
}

// ---------- Backend ----------
async function api<T>(path: string, method: string, uid: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PUSH_API_KEY,
      'x-tuya-uid': uid,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Reminder API ${method} ${path} lỗi ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Reminder của thiết bị này (null nếu bồn CHƯA bật theo dõi - riêng từng thiết bị). */
export async function getReminder(deviceId: string, uid: string): Promise<Reminder | null> {
  if (mockLocally(deviceId)) {
    await mockReady;
    const s = mockStore.get(deviceId);
    return s ? mockViewOf(deviceId, s) : null;
  }
  return api<Reminder | null>(`/reminders/${deviceId}`, 'GET', uid);
}

/** Tạo/cập nhật reminder (interval / bật-tắt) cho ĐÚNG thiết bị này. */
export async function saveReminder(deviceId: string, uid: string, input: ReminderInput): Promise<Reminder> {
  if (mockLocally(deviceId)) {
    await mockReady;
    const s = mockStore.get(deviceId) ?? newMockState();
    if (input.intervalDays != null) s.intervalDays = input.intervalDays;
    if (input.enabled != null) s.enabled = input.enabled;
    mockStore.set(deviceId, s);
    await mockPersist();
    return mockViewOf(deviceId, s);
  }
  return api<Reminder>(`/reminders/${deviceId}`, 'PUT', uid, input);
}

/** "Replaced now" → reset countdown về intervalDays (chỉ thiết bị này). */
export async function markReplaced(deviceId: string, uid: string): Promise<Reminder> {
  if (mockLocally(deviceId)) {
    await mockReady;
    const s = mockStore.get(deviceId) ?? newMockState();
    s.lastReplacedAt = Date.now();
    mockStore.set(deviceId, s);
    await mockPersist();
    return mockViewOf(deviceId, s);
  }
  return api<Reminder>(`/reminders/${deviceId}/mark-replaced`, 'POST', uid);
}

/** Xoá reminder của thiết bị (chỉ thiết bị này). */
export async function deleteReminder(deviceId: string, uid: string): Promise<void> {
  if (mockLocally(deviceId)) {
    await mockReady;
    mockStore.delete(deviceId);
    await mockPersist();
    return;
  }
  return api<void>(`/reminders/${deviceId}`, 'DELETE', uid);
}

async function readPendingDeletes(): Promise<PendingDelete[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingDelete => !!item && typeof item.deviceId === 'string' && typeof item.uid === 'string');
  } catch {
    return [];
  }
}

async function writePendingDeletes(items: PendingDelete[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(items));
  } catch {
    /* cleanup queue best-effort; không được làm hỏng luồng remove Tuya đã thành công */
  }
}

async function removePendingDelete(deviceId: string, uid: string): Promise<void> {
  const items = await readPendingDeletes();
  await writePendingDeletes(items.filter((item) => item.deviceId !== deviceId || item.uid !== uid));
}

async function enqueuePendingDelete(deviceId: string, uid: string): Promise<void> {
  const items = await readPendingDeletes();
  if (!items.some((item) => item.deviceId === deviceId && item.uid === uid)) {
    items.push({ deviceId, uid });
  }
  await writePendingDeletes(items);
}

/**
 * Dọn reminder SAU KHI Tuya đã remove thành công. Backend lỗi không được biến thiết bị thành "xoá
 * nửa vời" trên UI: ghi queue local và retry ở lần app chạy/đăng nhập kế tiếp.
 */
export async function cleanupRemovedDeviceReminder(deviceId: string, uid: string): Promise<boolean> {
  try {
    await deleteReminder(deviceId, uid);
    await removePendingDelete(deviceId, uid);
    return true;
  } catch {
    if (deviceId && uid) await enqueuePendingDelete(deviceId, uid);
    return false;
  }
}

/** Retry tuần tự để không dồn request backend; chỉ xử lý queue của user đang đăng nhập. */
export async function retryPendingReminderDeletes(uid: string): Promise<void> {
  if (!uid) return;
  const items = await readPendingDeletes();
  const keep: PendingDelete[] = [];
  for (const item of items) {
    if (item.uid !== uid) {
      keep.push(item);
      continue;
    }
    try {
      await deleteReminder(item.deviceId, uid);
    } catch {
      keep.push(item);
    }
  }
  await writePendingDeletes(keep);
}
