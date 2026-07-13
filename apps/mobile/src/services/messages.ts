// Lịch sử thông báo THEO USER, GỘP 2 nguồn (m1-notification-history):
//  • Tuya Message Center (getMessageList) - Tuya App Push + device/system messages; có hasNotRead.
//  • Backend NotificationLog (GET /me/notifications) - noti gửi qua FCM (provider=fcm không vào Tuya center).
// provider=tuya → backend không có bản ghi FCM → chỉ hiện Tuya center (đúng nhánh 1).
// provider=fcm  → hiện Tuya center + FCM log (đúng nhánh 2 "combine cả 2").
// Native vắng (Metro dev) → Tuya mock; FCM vẫn gọi backend nếu có PUSH_API_KEY + uid.
import { API_BASE_URL, PUSH_API_KEY } from '../config/api';
import { getReadState, markRead } from './notificationsRead';
import { parseWhen } from '../lib/time';
import { notifDiag } from './notifDiag'; // B1 DIAGNOSTIC - gỡ sau

export type AppMessage = {
  id: string;
  msgType: string; // 'alarm' | 'family' | 'notification'
  title: string;
  content: string;
  dateTime: string; // 'YYYY-MM-DD HH:mm' (đã chuẩn hoá)
  ts: number; // epoch ms để sort + tính unread
  hasNotRead: boolean;
};
export type MessagePage = { list: AppMessage[]; hasMore: boolean };

let lib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}
export const messagesAvailable: boolean = lib != null && lib.Tuya != null;

const CAP = 50; // số bản ghi tối đa mỗi nguồn (đủ cho lịch sử thông báo cá nhân)

// '2026-07-01 09:00' (dấu cách - Tuya) hoặc ISO (FCM) → epoch ms. Dùng parseWhen (an toàn Hermes;
// `new Date("2026-07-01 09:00")` trả NaN trên Hermes → phải ghép tường minh). Xem lib/time.ts.
const whenToTs = parseWhen;

// ISO → 'YYYY-MM-DD HH:mm' (giờ local) cho khớp format Tuya.
function fmtLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Mock Tuya: 2 thông báo demo để UI dev chạy được (không có ts - mapItem tự tính).
const MOCK: Array<Omit<AppMessage, 'ts'>> = [
  {
    id: 'mock-1',
    msgType: 'notification',
    title: 'Welcome to Walrus',
    content: 'Your ice bath is ready. Start your first ritual today.',
    dateTime: '2026-07-01 09:00',
    hasNotRead: true,
  },
  {
    id: 'mock-2',
    msgType: 'alarm',
    title: 'Filter reminder',
    content: 'Your filter is due for a change in 7 days.',
    dateTime: '2026-06-28 18:30',
    hasNotRead: false,
  },
];

function mapItem(m: any): AppMessage {
  const dateTime = m?.dateTime ?? '';
  return {
    id: m?.id ?? '',
    msgType: m?.msgType ?? 'notification',
    title: m?.title || m?.typeContent || 'Notification',
    content: m?.content ?? '',
    dateTime,
    ts: whenToTs(dateTime),
    hasNotRead: !!m?.hasNotRead,
  };
}

/** Trang thông báo Tuya Message Center. */
async function getTuyaMessages(offset: number, limit: number): Promise<MessagePage> {
  if (!messagesAvailable) return { list: offset === 0 ? MOCK.map(mapItem) : [], hasMore: false };
  try {
    const page = await lib.Tuya.getMessageList(offset, limit);
    const list = Array.isArray(page?.list) ? page.list.map(mapItem) : [];
    return { list, hasMore: !!page?.hasMore };
  } catch {
    return { list: [], hasMore: false }; // fail-soft: Tuya lỗi vẫn hiện được FCM (không làm rỗng cả màn)
  }
}

/** Lịch sử FCM từ backend (/me/notifications). Chưa cấu hình key / chưa đăng nhập → rỗng. */
async function getFcmHistory(uid: string): Promise<AppMessage[]> {
  // B1 DIAGNOSTIC: #1 nghi FCM-history rỗng vì key/uid/config. Log điều kiện vào + kết quả.
  notifDiag('fcm.enter', { apiKeySet: !!PUSH_API_KEY, uidSet: !!uid, base: API_BASE_URL });
  if (!PUSH_API_KEY || !uid) {
    notifDiag('fcm.skip', { reason: !PUSH_API_KEY ? 'PUSH_API_KEY rỗng' : 'uid rỗng' }); // B1
    return [];
  }
  try {
    const res = await fetch(`${API_BASE_URL}/me/notifications?offset=0&limit=${CAP}`, {
      headers: { 'x-api-key': PUSH_API_KEY, 'x-tuya-uid': uid },
    });
    if (!res.ok) {
      notifDiag('fcm.httpError', { status: res.status }); // B1 - 401 = sai key; 5xx = backend
      return [];
    }
    const data = (await res.json()) as {
      list?: Array<{ id: string; title: string; content: string; dateTime: string }>;
    };
    notifDiag('fcm.ok', { status: res.status, count: (data.list ?? []).length }); // B1
    return (data.list ?? []).map((r) => ({
      id: `fcm-${r.id}`,
      msgType: 'notification',
      title: r.title,
      content: r.content,
      dateTime: fmtLocal(r.dateTime),
      ts: whenToTs(r.dateTime),
      hasNotRead: false, // đặt ở mergeMessages theo lastReadAt
    }));
  } catch (e) {
    notifDiag('fcm.fetchError', { err: String(e) }); // B1 - mạng / JSON
    return [];
  }
}

/**
 * Gộp Tuya + FCM (thuần, test được). Read-state THEO TỪNG MESSAGE: 1 noti = chưa đọc ⟺ id KHÔNG nằm trong
 * `readIds`. Không còn dựa `ts > lastReadAt` (giòn vì parse Hermes) - áp đồng nhất cho cả 2 nguồn.
 * Sort mới nhất trước theo ts.
 */
export function mergeMessages(tuya: AppMessage[], fcm: AppMessage[], readIds: Set<string>): AppMessage[] {
  return [...tuya, ...fcm]
    .map((m) => ({ ...m, hasNotRead: !readIds.has(m.id) }))
    .sort((a, b) => b.ts - a.ts);
}

/** Danh sách thông báo đã GỘP của user hiện tại (Tuya + FCM), mới nhất trước. */
export async function getMessages(uid: string): Promise<MessagePage> {
  const [tuya, fcm, readState] = await Promise.all([
    getTuyaMessages(0, CAP),
    getFcmHistory(uid),
    getReadState(uid),
  ]);
  const all = [...tuya.list, ...fcm];
  let readIds = readState.ids;
  // Migration v1→v2 (user chốt): lần đầu chạy bản mới → coi MỌI noti hiện có là ĐÃ ĐỌC (badge không nổ 1 lần).
  if (!readState.initialized) {
    const ids = all.map((m) => m.id);
    await markRead(uid, ids);
    readIds = new Set([...readIds, ...ids]);
    notifDiag('migrate.v1_to_v2', { uid, markedRead: ids.length });
  }
  const list = mergeMessages(tuya.list, fcm, readIds);
  // B1 DIAGNOSTIC: chốt #1 (nguồn nào rỗng) + #2 (item "mới" là FCM hay Tuya, ts=0 do parse?).
  notifDiag('getMessages', {
    tuyaCount: tuya.list.length,
    fcmCount: fcm.length,
    readCount: readIds.size,
    initialized: readState.initialized,
    unread: list.filter((m) => m.hasNotRead).length,
    sample: list.slice(0, 6).map((m) => ({ id: m.id, type: m.msgType, ts: m.ts, unread: m.hasNotRead })),
  });
  return { list, hasMore: false };
}

/** Số thông báo CHƯA ĐỌC (id không nằm trong read-set của user). */
export async function getUnreadCount(uid: string): Promise<number> {
  const { list } = await getMessages(uid);
  return list.reduce((n, m) => n + (m.hasNotRead ? 1 : 0), 0);
}

/** Xoá thông báo: FCM (`fcm-*`) qua backend `/me/notifications/:id`; Tuya qua SDK. */
export async function deleteMessages(ids: string[], uid: string): Promise<boolean> {
  const fcmLogIds = ids.filter((id) => id.startsWith('fcm-')).map((id) => id.slice(4)); // bỏ tiền tố 'fcm-'
  const tuyaIds = ids.filter((id) => !id.startsWith('fcm-'));
  if (fcmLogIds.length > 0 && PUSH_API_KEY && uid) {
    await Promise.all(
      fcmLogIds.map((id) =>
        fetch(`${API_BASE_URL}/me/notifications/${id}`, {
          method: 'DELETE',
          headers: { 'x-api-key': PUSH_API_KEY, 'x-tuya-uid': uid },
        }).catch(() => undefined),
      ),
    );
  }
  if (messagesAvailable && tuyaIds.length > 0) {
    await lib.Tuya.deleteMessages(tuyaIds);
  }
  return true;
}
