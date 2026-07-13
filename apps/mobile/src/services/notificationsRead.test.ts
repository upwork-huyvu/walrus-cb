// Read-set per-user (B3). Mock AsyncStorage in-memory để test persist + per-user + cap.
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
    return Promise.resolve();
  },
}));

import { getReadState, markRead } from './notificationsRead';

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('getReadState / markRead', () => {
  it('lần đầu: chưa initialized, tập rỗng', async () => {
    const s = await getReadState('u1');
    expect(s.initialized).toBe(false);
    expect(s.ids.size).toBe(0);
  });

  it('markRead → id vào tập, initialized=true, BỀN qua đọc lại', async () => {
    await markRead('u1', ['a', 'b']);
    const s = await getReadState('u1');
    expect(s.initialized).toBe(true);
    expect([...s.ids].sort()).toEqual(['a', 'b']);
  });

  it('markRead merge, unique, không mất id cũ', async () => {
    await markRead('u1', ['a']);
    await markRead('u1', ['a', 'c']);
    const s = await getReadState('u1');
    expect([...s.ids].sort()).toEqual(['a', 'c']);
  });

  it('PER-USER: read-set của u1 và u2 tách biệt (không lẫn)', async () => {
    await markRead('u1', ['a']);
    await markRead('u2', ['b']);
    expect([...(await getReadState('u1')).ids]).toEqual(['a']);
    expect([...(await getReadState('u2')).ids]).toEqual(['b']);
  });

  it('cap 500: giữ id MỚI nhất, evict cũ nhất', async () => {
    const many = Array.from({ length: 600 }, (_, i) => `id${i}`);
    await markRead('u1', many);
    const s = await getReadState('u1');
    expect(s.ids.size).toBe(500);
    expect(s.ids.has('id599')).toBe(true); // mới nhất còn
    expect(s.ids.has('id0')).toBe(false); // cũ nhất bị evict
  });

  it('markRead([]) vẫn khởi tạo key (migration khi 0 noti)', async () => {
    await markRead('u1', []);
    expect((await getReadState('u1')).initialized).toBe(true);
  });

  it('uid rỗng → key "anon" (guest), không crash', async () => {
    await markRead('', ['g']);
    expect([...(await getReadState('')).ids]).toEqual(['g']);
  });
});
