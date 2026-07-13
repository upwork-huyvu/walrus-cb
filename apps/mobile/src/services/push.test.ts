export {}; // module scope

// Rev 2 (Option A): token đăng ký với TUYA - Android FCM, iOS APNs; không còn backend /push/tokens.
type LoadOpts = {
  available?: boolean;
  platform?: 'android' | 'ios';
  requestPermission?: jest.Mock;
  getToken?: jest.Mock;
  getAPNSToken?: jest.Mock;
  registerDeviceForRemoteMessages?: jest.Mock;
  registerDevice?: jest.Mock;
  unregisterDevice?: jest.Mock;
  deleteToken?: jest.Mock;
  apiKey?: string; // PUSH_API_KEY: '' (mặc định) → bỏ đăng ký backend
  registerPushToken?: jest.Mock;
  unregisterPushToken?: jest.Mock;
};

function load(opts: LoadOpts = {}) {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: { OS: opts.platform ?? 'android' },
  }));
  // Backend client + config (đăng ký FCM token). apiKey='' → push.ts bỏ qua backend.
  const registerPushToken = opts.registerPushToken ?? jest.fn().mockResolvedValue(undefined);
  const unregisterPushToken = opts.unregisterPushToken ?? jest.fn().mockResolvedValue(undefined);
  jest.doMock('../config/api', () => ({
    API_BASE_URL: 'http://backend.test',
    PUSH_API_KEY: opts.apiKey ?? '',
  }));
  jest.doMock('./api', () => ({ registerPushToken, unregisterPushToken }));
  const deleteToken = opts.deleteToken ?? jest.fn().mockResolvedValue(undefined);
  const registerDeviceForRemoteMessages =
    opts.registerDeviceForRemoteMessages ?? jest.fn().mockResolvedValue(undefined);
  const onMessage = jest.fn((_h?: (msg: any) => void) => () => {}); // lưu handler foreground để test gọi tay
  const messagingFn = jest.fn(() => ({
    requestPermission: opts.requestPermission ?? jest.fn().mockResolvedValue(1),
    getToken: opts.getToken ?? jest.fn().mockResolvedValue('fcm-tok'),
    getAPNSToken: opts.getAPNSToken ?? jest.fn().mockResolvedValue('apns-tok'),
    registerDeviceForRemoteMessages,
    onTokenRefresh: jest.fn(() => () => {}),
    onMessage,
    deleteToken,
  }));
  jest.doMock('@react-native-firebase/messaging', () =>
    opts.available === false ? (() => { throw new Error('no native'); })() : { default: messagingFn },
  );
  jest.doMock('@notifee/react-native', () => ({
    default: { requestPermission: jest.fn().mockResolvedValue({}), createChannel: jest.fn(), displayNotification: jest.fn() },
  }));
  const registerDevice = opts.registerDevice ?? jest.fn().mockResolvedValue(undefined);
  const unregisterDevice = opts.unregisterDevice ?? jest.fn().mockResolvedValue(undefined);
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () => ({
    Tuya: { registerDevice, unregisterDevice },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const mod = require('./push');
  return {
    push: mod,
    registerDevice,
    unregisterDevice,
    deleteToken,
    registerDeviceForRemoteMessages,
    registerPushToken,
    unregisterPushToken,
    onMessage,
  };
}

describe('onForegroundMessage → refresh badge (#3)', () => {
  it('nhận push foreground → gọi onReceive (để refresh badge unread)', () => {
    const { push, onMessage } = load();
    const onReceive = jest.fn();
    push.onForegroundMessage(onReceive);
    // Lấy handler mà push đăng ký với messaging.onMessage rồi bắn 1 message giả.
    const handler = onMessage.mock.calls[0]?.[0] as (msg: any) => void;
    handler({ notification: { title: 'Hi', body: 'body' }, data: {} });
    expect(onReceive).toHaveBeenCalledTimes(1);
  });

  it('không truyền onReceive → vẫn không nổ (chỉ hiện notifee)', () => {
    const { push, onMessage } = load();
    push.onForegroundMessage();
    const handler = onMessage.mock.calls[0]?.[0] as (msg: any) => void;
    expect(() => handler({ notification: { title: 'x' } })).not.toThrow();
  });

  it('native vắng → no-op, không đăng ký onMessage', () => {
    const { push, onMessage } = load({ available: false });
    const unsub = push.onForegroundMessage(jest.fn());
    expect(typeof unsub).toBe('function');
    expect(onMessage).not.toHaveBeenCalled();
  });
});

describe('routeFromData (thuần)', () => {
  const { push } = load();
  it('không có screen → mặc định tab notifications (Tuya push không có custom data)', () => {
    expect(push.routeFromData(undefined)).toEqual({ screen: 'notifications' });
    expect(push.routeFromData({})).toEqual({ screen: 'notifications' });
  });
  it('có screen + devId/homeId → params ép kiểu (nguồn khác/tương lai)', () => {
    expect(push.routeFromData({ screen: 'device-detail', devId: 'd1', homeId: '7' })).toEqual({
      screen: 'device-detail',
      params: { devId: 'd1', homeId: 7 },
    });
  });
});

describe('syncPushToken (→ Tuya registerDevice)', () => {
  it('native vắng → no-op, không đăng ký Tuya', async () => {
    const registerDevice = jest.fn();
    const { push } = load({ available: false, registerDevice });
    expect(push.pushAvailable).toBe(false);
    await push.syncPushToken();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('quyền bị từ chối (status 0) → không lấy token, không đăng ký', async () => {
    const getToken = jest.fn();
    const { push, registerDevice } = load({
      requestPermission: jest.fn().mockResolvedValue(0),
      getToken,
    });
    await push.syncPushToken();
    expect(getToken).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('Android đủ quyền + có token → registerDevice(token, "fcm") với Tuya', async () => {
    const { push, registerDevice } = load();
    await push.syncPushToken();
    expect(registerDevice).toHaveBeenCalledWith('fcm-tok', 'fcm');
  });

  it('iOS đủ quyền + có APNs token → registerDevice(token, "apns") với Tuya', async () => {
    const { push, registerDevice, registerDeviceForRemoteMessages } = load({ platform: 'ios' });
    await push.syncPushToken();
    expect(registerDeviceForRemoteMessages).toHaveBeenCalled();
    expect(registerDevice).toHaveBeenCalledWith('apns-tok', 'apns');
  });

  it('iOS chưa có APNs token → không đăng ký Tuya', async () => {
    const { push, registerDevice } = load({ platform: 'ios', getAPNSToken: jest.fn().mockResolvedValue(null) });
    await push.syncPushToken();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('registerDevice lỗi → nuốt (không throw)', async () => {
    const { push } = load({ registerDevice: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(push.syncPushToken()).resolves.toBeUndefined();
  });
});

describe('syncPushToken → đăng ký backend FCM (khi có PUSH_API_KEY + uid)', () => {
  it('có apiKey + uid → registerPushToken(uid, fcm-token, platform) với backend', async () => {
    const { push, registerPushToken } = load({ apiKey: 'k1' });
    await push.syncPushToken('uid-1');
    expect(registerPushToken).toHaveBeenCalledWith('uid-1', 'fcm-tok', 'android');
  });

  it('iOS: backend dùng FCM token (getToken), KHÔNG phải APNs thô', async () => {
    const { push, registerPushToken } = load({ apiKey: 'k1', platform: 'ios' });
    await push.syncPushToken('uid-1');
    expect(registerPushToken).toHaveBeenCalledWith('uid-1', 'fcm-tok', 'ios');
  });

  it('KHÔNG có apiKey → bỏ qua backend (chỉ Tuya)', async () => {
    const { push, registerPushToken, registerDevice } = load({ apiKey: '' });
    await push.syncPushToken('uid-1');
    expect(registerDevice).toHaveBeenCalled();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('KHÔNG có uid → bỏ qua backend (dù có apiKey)', async () => {
    const { push, registerPushToken } = load({ apiKey: 'k1' });
    await push.syncPushToken();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('backend lỗi → nuốt (không hỏng đường Tuya)', async () => {
    const registerPushToken = jest.fn().mockRejectedValue(new Error('backend down'));
    const { push, registerDevice } = load({ apiKey: 'k1', registerPushToken });
    await expect(push.syncPushToken('uid-1')).resolves.toBeUndefined();
    expect(registerDevice).toHaveBeenCalled(); // Tuya vẫn chạy
  });
});

describe('removePushToken (logout)', () => {
  it('Android xoá FCM token local (không còn gọi backend)', async () => {
    const { push, deleteToken } = load();
    await push.removePushToken();
    expect(deleteToken).toHaveBeenCalled();
  });

  it('iOS clear APNs token trong Tuya SDK', async () => {
    const { push, unregisterDevice, deleteToken } = load({ platform: 'ios' });
    await push.removePushToken();
    expect(unregisterDevice).toHaveBeenCalled();
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it('native vắng → no-op', async () => {
    const deleteToken = jest.fn();
    const { push } = load({ available: false, deleteToken });
    await push.removePushToken();
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it('có apiKey → gỡ token FCM khỏi backend (unregisterPushToken) trước khi deleteToken', async () => {
    const { push, unregisterPushToken, deleteToken } = load({ apiKey: 'k1' });
    await push.removePushToken();
    expect(unregisterPushToken).toHaveBeenCalledWith('fcm-tok');
    expect(deleteToken).toHaveBeenCalled();
  });

  it('KHÔNG có apiKey → không gọi backend', async () => {
    const { push, unregisterPushToken } = load({ apiKey: '' });
    await push.removePushToken();
    expect(unregisterPushToken).not.toHaveBeenCalled();
  });
});
