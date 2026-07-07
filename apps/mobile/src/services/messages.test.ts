// messages.ts → notificationsRead → AsyncStorage: mock stub để load module (test mergeMessages thuần).
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
}));

import { mergeMessages, type AppMessage } from './messages';

const msg = (over: Partial<AppMessage>): AppMessage => ({
  id: 'x',
  msgType: 'notification',
  title: 'T',
  content: 'C',
  dateTime: '',
  ts: 0,
  hasNotRead: false,
  ...over,
});

describe('mergeMessages (gộp Tuya + FCM)', () => {
  it('sort mới nhất trước theo ts (trộn 2 nguồn)', () => {
    const tuya = [msg({ id: 't1', ts: 100 }), msg({ id: 't2', ts: 300 })];
    const fcm = [msg({ id: 'f1', ts: 200 })];
    expect(mergeMessages(tuya, fcm, 0).map((m) => m.id)).toEqual(['t2', 'f1', 't1']);
  });

  it('read-state ĐỒNG NHẤT theo lastReadAt cho cả Tuya lẫn FCM', () => {
    const tuya = [msg({ id: 't1', ts: 100, hasNotRead: true })]; // hasNotRead gốc bị override
    const fcm = [msg({ id: 'fNew', ts: 500 }), msg({ id: 'fOld', ts: 250 })];
    const byId = Object.fromEntries(
      mergeMessages(tuya, fcm, 300).map((m) => [m.id, m.hasNotRead]),
    );
    expect(byId.t1).toBe(false); // 100 <= 300 → đã đọc (bỏ qua hasNotRead gốc)
    expect(byId.fOld).toBe(false); // 250 <= 300 → đã đọc
    expect(byId.fNew).toBe(true); // 500 > 300 → chưa đọc
  });

  it('lastReadAt=0 (lần đầu) → mọi noti đều chưa đọc', () => {
    const out = mergeMessages([msg({ id: 't1', ts: 100 })], [msg({ id: 'f1', ts: 50 })], 0);
    expect(out.every((m) => m.hasNotRead)).toBe(true);
  });
});
