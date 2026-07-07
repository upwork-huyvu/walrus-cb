// Lịch sử thông báo THEO USER, GỘP 2 nguồn (m1-notification-history):
//  • Tuya Message Center (getMessageList) - Tuya App Push + device/system messages; có hasNotRead.
//  • Backend NotificationLog (GET /me/notifications) - noti gửi qua FCM (provider=fcm không vào Tuya center).
// provider=tuya → backend không có bản ghi FCM → chỉ hiện Tuya center (đúng nhánh 1).
// provider=fcm  → hiện Tuya center + FCM log (đúng nhánh 2 "combine cả 2").
// Native vắng (Metro dev) → Tuya mock; FCM vẫn gọi backend nếu có PUSH_API_KEY + uid.
import { API_BASE_URL, PUSH_API_KEY } from '../config/api';
import { getLastReadAt } from './notificationsRead';

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

// '2026-07-01 09:00' hoặc ISO → epoch ms (0 nếu không parse được).
function whenToTs(s: string): number {
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

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
  if (!PUSH_API_KEY || !uid) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/me/notifications?offset=0&limit=${CAP}`, {
      headers: { 'x-api-key': PUSH_API_KEY, 'x-tuya-uid': uid },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      list?: Array<{ id: string; title: string; content: string; dateTime: string }>;
    };
    return (data.list ?? []).map((r) => ({
      id: `fcm-${r.id}`,
      msgType: 'notification',
      title: r.title,
      content: r.content,
      dateTime: fmtLocal(r.dateTime),
      ts: whenToTs(r.dateTime),
      hasNotRead: false, // đặt ở mergeMessages theo lastReadAt
    }));
  } catch {
    return [];
  }
}

/**
 * Gộp Tuya + FCM (thuần, test được). Read-state ĐỒNG NHẤT theo lastReadAt (local): noti mới hơn mốc
 * "đã xem lần cuối" = chưa đọc - áp cho cả 2 nguồn, để badge tự về 0 khi mở màn Notifications (ta không
 * gọi Tuya markRead). Sort mới nhất trước theo ts.
 */
export function mergeMessages(tuya: AppMessage[], fcm: AppMessage[], lastReadAt: number): AppMessage[] {
  return [...tuya, ...fcm]
    .map((m) => ({ ...m, hasNotRead: m.ts > lastReadAt }))
    .sort((a, b) => b.ts - a.ts);
}

/** Danh sách thông báo đã GỘP của user hiện tại (Tuya + FCM), mới nhất trước. */
export async function getMessages(uid: string): Promise<MessagePage> {
  const [tuya, fcm, lastReadAt] = await Promise.all([
    getTuyaMessages(0, CAP),
    getFcmHistory(uid),
    getLastReadAt(),
  ]);
  return { list: mergeMessages(tuya.list, fcm, lastReadAt), hasMore: false };
}

/** Số thông báo CHƯA ĐỌC (Tuya hasNotRead + FCM mới hơn lastReadAt). */
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
