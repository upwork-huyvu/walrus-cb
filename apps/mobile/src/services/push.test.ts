export {}; // module scope

// Rev 2 (Option A): token đăng ký với TUYA — Android FCM, iOS APNs; không còn backend /push/tokens.
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
};

function load(opts: LoadOpts = {}) {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: { OS: opts.platform ?? 'android' },
  }));
  const deleteToken = opts.deleteToken ?? jest.fn().mockResolvedValue(undefined);
  const registerDeviceForRemoteMessages =
    opts.registerDeviceForRemoteMessages ?? jest.fn().mockResolvedValue(undefined);
  const messagingFn = jest.fn(() => ({
    requestPermission: opts.requestPermission ?? jest.fn().mockResolvedValue(1),
    getToken: opts.getToken ?? jest.fn().mockResolvedValue('fcm-tok'),
    getAPNSToken: opts.getAPNSToken ?? jest.fn().mockResolvedValue('apns-tok'),
    registerDeviceForRemoteMessages,
    onTokenRefresh: jest.fn(() => () => {}),
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
  return { push: mod, registerDevice, unregisterDevice, deleteToken, registerDeviceForRemoteMessages };
}

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
});
