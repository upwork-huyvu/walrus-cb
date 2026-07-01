export {}; // đánh dấu module → LoadOpts/load scope theo file (tránh trùng tên global với test khác)
// Test appleAuth: nạp lại module với authAvailable/native giả theo từng case.
type LoadOpts = {
  authAvailable: boolean;
  isSupported?: boolean;
  performRequest?: jest.Mock;
};

const CANCELED = '1001';
const FAILED = '1004';

function load(opts: LoadOpts) {
  jest.resetModules();
  jest.doMock('./auth', () => ({ authAvailable: opts.authAvailable }));
  jest.doMock('@invertase/react-native-apple-authentication', () => ({
    appleAuth: {
      isSupported: opts.isSupported ?? false,
      Operation: { LOGIN: 1 },
      Scope: { EMAIL: 0, FULL_NAME: 1 },
      Error: { CANCELED, FAILED },
      performRequest:
        opts.performRequest ??
        jest.fn().mockResolvedValue({ identityToken: 'tok', user: 'u1', email: 'a@b.c', fullName: { nickname: 'Nick' } }),
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./appleAuth');
}

describe('appleAuth.signInApple', () => {
  afterEach(() => jest.resetModules());

  it('chưa build native (authAvailable=false) → trả mock credential', async () => {
    const m = load({ authAvailable: false });
    const c = await m.signInApple();
    expect(c.identityToken).toBe('mock-apple-id-token');
  });

  it('build thật nhưng không hỗ trợ (Android/simulator cũ) → NOT_SUPPORTED', async () => {
    const m = load({ authAvailable: true, isSupported: false });
    await expect(m.signInApple()).rejects.toMatchObject({ code: 'NOT_SUPPORTED' });
  });

  it('iOS hỗ trợ + authorize thành công → trả identityToken + fields', async () => {
    const m = load({ authAvailable: true, isSupported: true });
    const c = await m.signInApple();
    expect(c).toMatchObject({ identityToken: 'tok', user: 'u1', email: 'a@b.c', fullName: 'Nick' });
  });

  it('user huỷ Apple sheet (Error.CANCELED) → CANCELLED', async () => {
    const err: any = new Error('user canceled');
    err.code = CANCELED;
    const m = load({ authAvailable: true, isSupported: true, performRequest: jest.fn().mockRejectedValue(err) });
    await expect(m.signInApple()).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('authorize OK nhưng identityToken null → NO_ID_TOKEN', async () => {
    const m = load({
      authAvailable: true,
      isSupported: true,
      performRequest: jest.fn().mockResolvedValue({ identityToken: null, user: 'u1' }),
    });
    await expect(m.signInApple()).rejects.toMatchObject({ code: 'NO_ID_TOKEN' });
  });
});
