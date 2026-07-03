export {}; // module scope

describe('services/api — push token', () => {
  const g = globalThis as any;
  afterEach(() => {
    jest.resetModules();
    delete g.fetch;
  });

  function load() {
    jest.resetModules();
    jest.doMock('../config/api', () => ({ API_BASE_URL: 'https://api.test', PUSH_API_KEY: 'secret' }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('./api');
  }

  it('registerPushToken POST đúng url/header/body', async () => {
    g.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const api = load();
    await api.registerPushToken('uid1', 'tok', 'android');
    expect(g.fetch).toHaveBeenCalledWith('https://api.test/push/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'secret' },
      body: JSON.stringify({ tuyaUid: 'uid1', token: 'tok', platform: 'android' }),
    });
  });

  it('unregisterPushToken DELETE body chỉ token', async () => {
    g.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    const api = load();
    await api.unregisterPushToken('tok');
    const [, opts] = g.fetch.mock.calls[0];
    expect(opts.method).toBe('DELETE');
    expect(JSON.parse(opts.body)).toEqual({ token: 'tok' });
  });

  it('response !ok → throw', async () => {
    g.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const api = load();
    await expect(api.registerPushToken('u', 't', 'ios')).rejects.toThrow('401');
  });
});
