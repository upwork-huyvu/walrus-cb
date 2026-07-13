// messages.ts → notificationsRead → AsyncStorage. mergeMessages là hàm thuần (test read-set per-message).
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

describe('mergeMessages (gộp Tuya + FCM, read-state THEO id)', () => {
  it('sort mới nhất trước theo ts (trộn 2 nguồn)', () => {
    const tuya = [msg({ id: 't1', ts: 100 }), msg({ id: 't2', ts: 300 })];
    const fcm = [msg({ id: 'f1', ts: 200 })];
    expect(mergeMessages(tuya, fcm, new Set()).map((m) => m.id)).toEqual(['t2', 'f1', 't1']);
  });

  it('id nằm trong read-set → đã đọc; ngoài → chưa đọc (cả Tuya lẫn FCM, không phụ thuộc ts)', () => {
    const tuya = [msg({ id: 't1', ts: 100, hasNotRead: true })]; // hasNotRead gốc bị override
    const fcm = [msg({ id: 'fRead', ts: 500 }), msg({ id: 'fNew', ts: 250 })];
    const byId = Object.fromEntries(
      mergeMessages(tuya, fcm, new Set(['t1', 'fRead'])).map((m) => [m.id, m.hasNotRead]),
    );
    expect(byId.t1).toBe(false); // trong read-set → đã đọc (bỏ qua hasNotRead gốc)
    expect(byId.fRead).toBe(false);
    expect(byId.fNew).toBe(true); // chưa có trong read-set → chưa đọc
  });

  it('read-set rỗng → mọi noti đều chưa đọc', () => {
    const out = mergeMessages([msg({ id: 't1', ts: 100 })], [msg({ id: 'f1', ts: 50 })], new Set());
    expect(out.every((m) => m.hasNotRead)).toBe(true);
  });

  it('không phụ thuộc ts (item ts=0 do parse Hermes vẫn đúng read-state theo id)', () => {
    const out = mergeMessages([msg({ id: 't0', ts: 0 })], [], new Set(['t0']));
    expect(out[0]?.hasNotRead).toBe(false); // ts=0 nhưng id đã đọc → đã đọc
  });
});
