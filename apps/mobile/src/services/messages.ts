// Adapter Message Center (thông báo THEO USER — Tuya lưu per-uid, admin backend push per-uid tới đây).
// Native có → lib Tuya thật; native vắng (Metro dev) → mock. Pattern require try/catch như services/tuya.ts.
export type AppMessage = {
  id: string;
  msgType: string; // 'alarm' | 'family' | 'notification'
  title: string;
  content: string;
  dateTime: string;
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

// Mock: 2 thông báo demo để UI dev chạy được.
const MOCK: AppMessage[] = [
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
  return {
    id: m?.id ?? '',
    msgType: m?.msgType ?? 'notification',
    title: m?.title || m?.typeContent || 'Notification',
    content: m?.content ?? '',
    dateTime: m?.dateTime ?? '',
    hasNotRead: !!m?.hasNotRead,
  };
}

/** Trang thông báo của user hiện tại (offset từ 0). */
export async function getMessages(offset: number, limit = 20): Promise<MessagePage> {
  if (!messagesAvailable) return { list: offset === 0 ? [...MOCK] : [], hasMore: false };
  const page = await lib.Tuya.getMessageList(offset, limit);
  const list = Array.isArray(page?.list) ? page.list.map(mapItem) : [];
  return { list, hasMore: !!page?.hasMore };
}

/** Xoá thông báo theo id. Trả true khi xoá xong. */
export async function deleteMessages(ids: string[]): Promise<boolean> {
  if (!messagesAvailable) return true;
  return lib.Tuya.deleteMessages(ids);
}
