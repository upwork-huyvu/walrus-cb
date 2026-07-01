export {}; // đánh dấu module → LoadOpts/load scope theo file (tránh trùng tên global với test khác)
// Test googleAuth: nạp lại module với config/native giả theo từng case (module require native lúc load).
type LoadOpts = {
  available: boolean;
  webClientId?: string;
  signIn?: jest.Mock;
  hasPlayServices?: jest.Mock;
};

function load(opts: LoadOpts) {
  jest.resetModules();
  jest.doMock('../config/google', () => ({
    GOOGLE_WEB_CLIENT_ID: opts.webClientId ?? '',
    GOOGLE_IOS_CLIENT_ID: '',
  }));
  jest.doMock('@react-native-google-signin/google-signin', () => ({
    // available=false mô phỏng Metro chưa build native (GoogleSignin không dùng được).
    GoogleSignin: opts.available
      ? {
          configure: jest.fn(),
          hasPlayServices: opts.hasPlayServices ?? jest.fn().mockResolvedValue(true),
          signIn: opts.signIn ?? jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'tok' } }),
          signOut: jest.fn(),
        }
      : null,
    statusCodes: { SIGN_IN_CANCELLED: 'CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./googleAuth');
}

describe('googleAuth.signInGoogle', () => {
  afterEach(() => jest.resetModules());

  it('native vắng (Metro) → googleAvailable=false, trả mock idToken', async () => {
    const m = load({ available: false });
    expect(m.googleAvailable).toBe(false);
    await expect(m.signInGoogle()).resolves.toBe('mock-google-id-token');
  });

  it('native có nhưng Web Client ID trống → throw NO_CONFIG', async () => {
    const m = load({ available: true, webClientId: '' });
    await expect(m.signInGoogle()).rejects.toMatchObject({ code: 'NO_CONFIG' });
  });

  it('cấu hình đủ + signIn success → trả idToken thật', async () => {
    const m = load({
      available: true,
      webClientId: 'web.apps.googleusercontent.com',
      signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'real-token' } }),
    });
    await expect(m.signInGoogle()).resolves.toBe('real-token');
  });

  it('user huỷ (type !== success) → throw CANCELLED', async () => {
    const m = load({
      available: true,
      webClientId: 'web.apps.googleusercontent.com',
      signIn: jest.fn().mockResolvedValue({ type: 'cancelled', data: null }),
    });
    await expect(m.signInGoogle()).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('success nhưng idToken null (webClientId sai type) → throw NO_ID_TOKEN', async () => {
    const m = load({
      available: true,
      webClientId: 'web.apps.googleusercontent.com',
      signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: null } }),
    });
    await expect(m.signInGoogle()).rejects.toMatchObject({ code: 'NO_ID_TOKEN' });
  });
});
