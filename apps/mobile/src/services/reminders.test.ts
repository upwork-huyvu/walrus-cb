export {}; // module scope

// Mock AsyncStorage bằng bộ nhớ (mockMem) - persist mock reminder per-device. Prefix `mock` để
// jest.mock factory được phép tham chiếu (rule out-of-scope).
let mockMem: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockMem[k] ?? null),
  setItem: (k: string, v: string) => {
    mockMem[k] = v;
    return Promise.resolve();
  },
}));

function load(apiKey: string) {
  jest.resetModules();
  jest.doMock('../config/api', () => ({
    API_BASE_URL: 'http://backend.test',
    PUSH_API_KEY: apiKey,
  }));

  return require('./reminders');
}

describe('reminders client - backend (có PUSH_API_KEY)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    (globalThis as { fetch: unknown }).fetch = fetchMock;
    fetchMock.mockReset();
    mockMem = {};
  });

  it('getReminder gọi GET /reminders/:id kèm x-api-key + x-tuya-uid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ deviceId: 'd1', stage: 'ok', daysRemaining: 90 }),
    });
    const mod = load('key-1');
    const r = await mod.getReminder('d1', 'uid-1');
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('http://backend.test/reminders/d1');
    expect(opts.method).toBe('GET');
    expect(opts.headers['x-api-key']).toBe('key-1');
    expect(opts.headers['x-tuya-uid']).toBe('uid-1');
    expect(r.deviceId).toBe('d1');
  });

  it('markReplaced → POST /reminders/:id/mark-replaced', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ deviceId: 'd1' }) });
    const mod = load('key-1');
    await mod.markReplaced('d1', 'uid-1');
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://backend.test/reminders/d1/mark-replaced');
    expect(opts.method).toBe('POST');
  });

  it('deleteReminder → DELETE, 204 không parse JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    const mod = load('key-1');
    await expect(mod.deleteReminder('d1', 'uid-1')).resolves.toBeUndefined();
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE');
  });

  it('res không ok → throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const mod = load('key-1');
    await expect(mod.getReminder('d1', 'uid-1')).rejects.toThrow('403');
  });
});

describe('reminders client - mock (PUSH_API_KEY rỗng, KHÔNG gọi fetch)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    (globalThis as { fetch: unknown }).fetch = fetchMock;
    fetchMock.mockReset();
    mockMem = {};
  });

  it('getReminder chưa track → null (mỗi bồn opt-in RIÊNG), không fetch', async () => {
    const mod = load('');
    const r = await mod.getReminder('d1', 'uid-1');
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saveReminder (Start tracking) → getReminder trả view mặc định 90d', async () => {
    const mod = load('');
    await mod.saveReminder('d1', 'uid-1', {});
    const r = await mod.getReminder('d1', 'uid-1');
    expect(r.deviceId).toBe('d1');
    expect(r.intervalDays).toBe(90);
    expect(r.stage).toBe('ok');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saveReminder(intervalDays) rồi getReminder phản ánh giá trị mới', async () => {
    const mod = load('');
    await mod.saveReminder('d1', 'uid-1', { intervalDays: 30 });
    const r = await mod.getReminder('d1', 'uid-1');
    expect(r.intervalDays).toBe(30);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('markReplaced reset daysRemaining về intervalDays', async () => {
    const mod = load('');
    const r = await mod.markReplaced('d1', 'uid-1');
    expect(r.daysRemaining).toBe(90);
    expect(r.stage).toBe('ok');
  });

  it('PER-DEVICE: d1 và d2 tách riêng - đổi/xoá d1 KHÔNG đụng d2', async () => {
    const mod = load('');
    await mod.saveReminder('d1', 'uid-1', { intervalDays: 30 });
    await mod.saveReminder('d2', 'uid-1', { intervalDays: 60 });
    expect((await mod.getReminder('d1', 'uid-1')).intervalDays).toBe(30);
    expect((await mod.getReminder('d2', 'uid-1')).intervalDays).toBe(60);
    await mod.deleteReminder('d1', 'uid-1');
    expect(await mod.getReminder('d1', 'uid-1')).toBeNull(); // d1 đã xoá
    expect((await mod.getReminder('d2', 'uid-1')).intervalDays).toBe(60); // d2 còn nguyên
  });

  it('persist: state còn lại sau khi reload module (qua AsyncStorage)', async () => {
    const mod1 = load('');
    await mod1.saveReminder('d1', 'uid-1', { intervalDays: 45 });
    const mod2 = load(''); // reload → nạp lại từ AsyncStorage (mockMem giữ nguyên)
    const r = await mod2.getReminder('d1', 'uid-1');
    expect(r.intervalDays).toBe(45);
  });
});
