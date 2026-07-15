export {}; // module scope

// Bug đang chặn: app khai BLUETOOTH_SCAN trong manifest nhưng KHÔNG BAO GIỜ xin runtime →
// startLeScan im lặng trả 0 kết quả → radar quay 120s rồi báo "không thấy thiết bị".
// Test dưới đây khoá đúng hành vi phải có: xin đủ quyền theo API level, và khi thiếu thì
// nói rõ lý do thay vì để UI quay mù.

const P = {
  SCAN: 'android.permission.BLUETOOTH_SCAN',
  CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
};

/** Nạp lại module với PermissionsAndroid giả; trả cả spy requestMultiple để soi đã xin những gì. */
function load(statuses: Record<string, string> = {}, opts: { throws?: boolean } = {}) {
  jest.resetModules();
  const requestMultiple = jest.fn(async (perms: string[]) => {
    if (opts.throws) throw new Error('boom');
    // Mặc định: quyền nào không khai trong `statuses` coi như granted.
    return Object.fromEntries(perms.map((p) => [p, statuses[p] ?? 'granted']));
  });
  jest.doMock('react-native', () => ({
    Platform: { OS: 'android', Version: 33 },
    PermissionsAndroid: {
      PERMISSIONS: {
        BLUETOOTH_SCAN: P.SCAN,
        BLUETOOTH_CONNECT: P.CONNECT,
        ACCESS_FINE_LOCATION: P.LOCATION,
      },
      RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
      requestMultiple,
    },
  }));
  jest.doMock('./pairingLog', () => ({ logPairing: jest.fn() }));
  return { mod: require('./blePermissions'), requestMultiple };
}

describe('blePermissionsFor - bộ quyền theo API level', () => {
  it('Android 12+ (API 31+) xin cả SCAN + CONNECT + LOCATION', () => {
    const { mod } = load();
    // LOCATION vẫn bắt buộc: manifest khai BLUETOOTH_SCAN KHÔNG có neverForLocation
    // → thiếu location thì scan trả rỗng dù đã có quyền Bluetooth.
    expect(mod.blePermissionsFor(31)).toEqual([P.SCAN, P.CONNECT, P.LOCATION]);
    expect(mod.blePermissionsFor(36)).toHaveLength(3);
  });

  it('Android ≤ 11 chỉ xin LOCATION (BLUETOOTH/BLUETOOTH_ADMIN là install-time, maxSdkVersion=30)', () => {
    const { mod } = load();
    expect(mod.blePermissionsFor(30)).toEqual([P.LOCATION]);
    expect(mod.blePermissionsFor(24)).toEqual([P.LOCATION]);
  });
});

describe('ensureBlePermissions', () => {
  it('grant đủ → ok, và đã thật sự xin đúng 3 quyền trên API 33', async () => {
    const { mod, requestMultiple } = load();
    const res = await mod.ensureBlePermissions({ platform: 'android', apiLevel: 33 });

    expect(res).toEqual({ ok: true });
    expect(requestMultiple).toHaveBeenCalledWith([P.SCAN, P.CONNECT, P.LOCATION]);
  });

  it('user bấm Deny → reason=denied + message nói cần quyền gì (không quay mù)', async () => {
    const { mod } = load({ [P.SCAN]: 'denied' });
    const res = await mod.ensureBlePermissions({ platform: 'android', apiLevel: 33 });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('denied');
    expect(res.message).toMatch(/Bluetooth/);
  });

  it('"Don\'t ask again" → reason=blocked + message chỉ đường sang Settings (hỏi lại vô ích)', async () => {
    const { mod } = load({ [P.SCAN]: 'never_ask_again' });
    const res = await mod.ensureBlePermissions({ platform: 'android', apiLevel: 33 });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('blocked');
    expect(res.message).toMatch(/Settings/);
  });

  it('thiếu LOCATION cũng phải chặn - đây chính là ca scan trả rỗng mà không ai ngờ', async () => {
    const { mod } = load({ [P.LOCATION]: 'denied' });
    const res = await mod.ensureBlePermissions({ platform: 'android', apiLevel: 33 });

    expect(res.ok).toBe(false);
    // Message phải nêu Location, không chỉ nói chung chung "Bluetooth".
    expect(res.message).toMatch(/Location/);
  });

  it('Android ≤ 11: chỉ cần LOCATION là chạy, không đòi SCAN/CONNECT', async () => {
    // SCAN bị denied nhưng ở API 30 nó không nằm trong bộ quyền cần xin → vẫn ok.
    const { mod, requestMultiple } = load({ [P.SCAN]: 'denied' });
    const res = await mod.ensureBlePermissions({ platform: 'android', apiLevel: 30 });

    expect(res).toEqual({ ok: true });
    expect(requestMultiple).toHaveBeenCalledWith([P.LOCATION]);
  });

  it('iOS → ok, không đụng PermissionsAndroid (hệ thống tự prompt)', async () => {
    const { mod, requestMultiple } = load();
    const res = await mod.ensureBlePermissions({ platform: 'ios' });

    expect(res).toEqual({ ok: true });
    expect(requestMultiple).not.toHaveBeenCalled();
  });

  it('requestMultiple ném lỗi → trả kết quả có kiểu, không để exception lọt lên UI', async () => {
    const { mod } = load({}, { throws: true });
    const res = await mod.ensureBlePermissions({ platform: 'android', apiLevel: 33 });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('denied');
  });
});
