export {}; // module scope

// Rev 2 (Option A): token đăng ký với TUYA (registerDevice(token,'fcm')) — không còn backend /push/tokens.
type LoadOpts = {
  available?: boolean;
  requestPermission?: jest.Mock;
  getToken?: jest.Mock;
  registerDevice?: jest.Mock;
  deleteToken?: jest.Mock;
};

function load(opts: LoadOpts = {}) {
  jest.resetModules();
  const deleteToken = opts.deleteToken ?? jest.fn().mockResolvedValue(undefined);
  const messagingFn = jest.fn(() => ({
    requestPermission: opts.requestPermission ?? jest.fn().mockResolvedValue(1),
    getToken: opts.getToken ?? jest.fn().mockResolvedValue('fcm-tok'),
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
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () => ({
    Tuya: { registerDevice },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const mod = require('./push');
  return { push: mod, registerDevice, deleteToken };
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

  it('đủ quyền + có token → registerDevice(token, "fcm") với Tuya', async () => {
    const { push, registerDevice } = load();
    await push.syncPushToken();
    expect(registerDevice).toHaveBeenCalledWith('fcm-tok', 'fcm');
  });

  it('registerDevice lỗi → nuốt (không throw)', async () => {
    const { push } = load({ registerDevice: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(push.syncPushToken()).resolves.toBeUndefined();
  });
});

describe('removePushToken (logout)', () => {
  it('xoá FCM token local (không còn gọi backend)', async () => {
    const { push, deleteToken } = load();
    await push.removePushToken();
    expect(deleteToken).toHaveBeenCalled();
  });

  it('native vắng → no-op', async () => {
    const deleteToken = jest.fn();
    const { push } = load({ available: false, deleteToken });
    await push.removePushToken();
    expect(deleteToken).not.toHaveBeenCalled();
  });
});
