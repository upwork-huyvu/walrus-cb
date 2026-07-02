export {}; // module scope

type LoadOpts = {
  available?: boolean;
  requestPermission?: jest.Mock;
  getToken?: jest.Mock;
  register?: jest.Mock;
  unregister?: jest.Mock;
};

function load(opts: LoadOpts = {}) {
  jest.resetModules();
  const messagingFn = jest.fn(() => ({
    requestPermission: opts.requestPermission ?? jest.fn().mockResolvedValue(1),
    getToken: opts.getToken ?? jest.fn().mockResolvedValue('fcm-tok'),
    onTokenRefresh: jest.fn(() => () => {}),
    deleteToken: jest.fn().mockResolvedValue(undefined),
  }));
  jest.doMock('@react-native-firebase/messaging', () =>
    opts.available === false ? (() => { throw new Error('no native'); })() : { default: messagingFn },
  );
  jest.doMock('@notifee/react-native', () => ({
    default: { requestPermission: jest.fn().mockResolvedValue({}), createChannel: jest.fn(), displayNotification: jest.fn() },
  }));
  jest.doMock('./api', () => ({
    registerPushToken: opts.register ?? jest.fn().mockResolvedValue(undefined),
    unregisterPushToken: opts.unregister ?? jest.fn().mockResolvedValue(undefined),
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./push');
}

describe('routeFromData (thuần)', () => {
  const push = load();
  it('không có screen → null', () => {
    expect(push.routeFromData(undefined)).toBeNull();
    expect(push.routeFromData({})).toBeNull();
  });
  it('có screen + devId/homeId → params ép kiểu', () => {
    expect(push.routeFromData({ screen: 'device-detail', devId: 'd1', homeId: '7' })).toEqual({
      screen: 'device-detail',
      params: { devId: 'd1', homeId: 7 },
    });
  });
});

describe('syncPushToken', () => {
  it('native vắng → no-op, không gọi api', async () => {
    const register = jest.fn();
    const push = load({ available: false, register });
    expect(push.pushAvailable).toBe(false);
    await push.syncPushToken('uid1');
    expect(register).not.toHaveBeenCalled();
  });

  it('uid rỗng → no-op', async () => {
    const register = jest.fn();
    const push = load({ register });
    await push.syncPushToken('');
    expect(register).not.toHaveBeenCalled();
  });

  it('quyền bị từ chối (status 0) → không đăng ký', async () => {
    const register = jest.fn();
    const push = load({ requestPermission: jest.fn().mockResolvedValue(0), register });
    await push.syncPushToken('uid1');
    expect(register).not.toHaveBeenCalled();
  });

  it('quyền OK + có token → registerPushToken(uid, token, platform)', async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    const push = load({ register });
    await push.syncPushToken('uid1');
    expect(register).toHaveBeenCalledWith('uid1', 'fcm-tok', expect.stringMatching(/android|ios/));
  });
});
