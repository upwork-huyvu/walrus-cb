export {}; // module scope

function load(nativeTuya: any | null) {
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () =>
    nativeTuya ? { Tuya: nativeTuya } : (() => { throw new Error('no native'); })(),
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./pairing');
}

describe('pairingStepLabel - nhãn confirm kiểu SmartLife', () => {
  const p = load(null);
  it.each([
    ['device_find', 'Searching for device…'],
    ['ble_connect', 'Connecting to device…'],
    ['device_bind_success', 'Connected'],
    ['initializing', 'Initializing…'],
    ['something_unknown', 'Pairing…'],
    // iOS: tên map từ ThingActivatorStep (lấy verbatim từ header SDK).
    ['device_found', 'Device found'],
    ['device_registered', 'Registering with the cloud…'],
    ['device_initialized', 'Initializing…'],
    // ⚠️ step 4 = TimeOut là LỖI. Bản cũ để nó rơi vào 'Pairing…' → UI báo "đang chạy" khi đã hỏng.
    ['device_timeout', 'Pairing timed out'],
    ['device_state_error', 'Pairing error'],
  ])('%s → %s', (step, label) => {
    expect(p.pairingStepLabel(step)).toBe(label);
  });
});

describe('isFailureStep - phân biệt LỖI với tiến trình', () => {
  const p = load(null);
  it.each(['device_timeout', 'device_state_error', 'connect_wifi_failed', 'TIME_OUT'])(
    '%s là lỗi → UI không được nhích checklist',
    (step) => expect(p.isFailureStep(step)).toBe(true),
  );
  it.each(['device_found', 'device_registered', 'device_initialized', 'device_bind_success'])(
    '%s là tiến trình thật',
    (step) => expect(p.isFailureStep(step)).toBe(false),
  );
});

describe('deviceNeedsWifi - route combo (hỏi Wi-Fi) vs BLE thuần (pair thẳng)', () => {
  const p = load(null);

  it('ưu tiên cờ isCombo native', () => {
    expect(p.deviceNeedsWifi({ isCombo: true })).toBe(true);
    expect(p.deviceNeedsWifi({ isCombo: false })).toBe(false);
  });

  it('iOS bleType: combo = {4,6,7,9,11}', () => {
    for (const t of [4, 6, 7, 9, 11]) expect(p.deviceNeedsWifi({ bleType: t })).toBe(true);
    for (const t of [1, 2, 3, 5, 8, 10]) expect(p.deviceNeedsWifi({ bleType: t })).toBe(false);
  });

  it('Android configType: chứa "wifi" = combo', () => {
    expect(p.deviceNeedsWifi({ configType: 'config_type_wifi' })).toBe(true);
    expect(p.deviceNeedsWifi({ configType: 'config_type_wifi_p' })).toBe(true);
    expect(p.deviceNeedsWifi({ configType: 'config_type_single' })).toBe(false);
    expect(p.deviceNeedsWifi({ configType: 'config_type_beacon' })).toBe(false);
  });

  it('isCombo thắng raw khi cả 2 cùng có', () => {
    expect(p.deviceNeedsWifi({ isCombo: false, bleType: 4 })).toBe(false);
  });

  it('không rõ gì → mặc định true (đa số thiết bị Tuya Wi-Fi là combo)', () => {
    expect(p.deviceNeedsWifi({})).toBe(true);
    expect(p.deviceNeedsWifi({ bleType: 0 })).toBe(true);
    expect(p.deviceNeedsWifi({ configType: '' })).toBe(true);
  });
});

describe('renameDevice', () => {
  it('native vắng → no-op (không throw)', async () => {
    const p = load(null);
    await expect(p.renameDevice('d1', 'Tên')).resolves.toBeUndefined();
  });

  it('native có → gọi lib.Tuya.renameDevice(devId, name)', async () => {
    const renameDevice = jest.fn().mockResolvedValue(undefined);
    const p = load({ renameDevice });
    await p.renameDevice('d1', 'Bồn của tôi');
    expect(renameDevice).toHaveBeenCalledWith('d1', 'Bồn của tôi');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// describeError / errorDetail  (m1-fix-wifi-pairing · B2)
//
// Bug gốc: iOS reject bằng literal @"pairing_error" → describeError() đẩy literal đó vào
// TuyaErrors.describe() → không khớp bảng mã → category 'unknown' → khách chỉ thấy
// "[sdk:pairing_error] Unknown error." còn message THẬT của SDK thì bị vứt.
// Hợp đồng mới: message native KHÔNG BAO GIỜ bị nuốt; mã phi-số KHÔNG BAO GIỜ vào bảng mã.
// ─────────────────────────────────────────────────────────────────────────────

/** Mock cả module (khác `load` ở trên: cho phép bơm thêm TuyaErrors). */
function loadModule(mod: any | null) {
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () =>
    mod ? mod : (() => { throw new Error('no native'); })(),
  );
  return require('./pairing');
}

describe('errorDetail', () => {
  const p = load(null);

  it('bóc đủ code / domain / message từ error native', () => {
    const d = p.errorDetail({ code: '-55', message: 'The token has expired.', userInfo: { domain: 'sdk' } });
    expect(d).toMatchObject({ code: '-55', domain: 'sdk', message: 'The token has expired.' });
  });

  it('lấy domain từ userInfo (không ép về "sdk" khi native nói "cloud")', () => {
    expect(p.errorDetail({ code: '1004', userInfo: { domain: 'cloud' } }).domain).toBe('cloud');
  });

  it('mặc định domain "sdk" khi native không gửi domain', () => {
    expect(p.errorDetail({ code: '-3', message: 'timeout' }).domain).toBe('sdk');
  });

  it('không nổ với undefined / null / string', () => {
    expect(p.errorDetail(undefined).code).toBe('');
    expect(p.errorDetail(null).message).toBe('');
    expect(p.errorDetail('boom').code).toBe('');
  });
});

describe('describeError', () => {
  const p = load(null);

  it('REGRESSION: không trả "Unknown error." khi native đã cho message', () => {
    // Đây đúng là error mà iOS gửi lên sau khi B1 sửa native.
    const out = p.describeError({
      code: 'pairing_error',
      message: 'Ghép nối Wi-Fi thất bại.',
      userInfo: { domain: 'sdk' },
    });
    expect(out).not.toMatch(/Unknown error/i);
    expect(out).toBe('Ghép nối Wi-Fi thất bại. [sdk:pairing_error]');
  });

  it('giữ message native + gắn mã Tuya thật', () => {
    const out = p.describeError({ code: '-55', message: 'The token has expired.', userInfo: { domain: 'sdk' } });
    expect(out).toBe('The token has expired. [sdk:-55]');
  });

  it('tôn trọng domain cloud', () => {
    const out = p.describeError({ code: '1004', message: 'sign invalid', userInfo: { domain: 'cloud' } });
    expect(out).toBe('sign invalid [cloud:1004]');
  });

  it('Error thường (không code) → trả nguyên message, không bịa mã', () => {
    expect(p.describeError(new Error('Pairing timed out - try again'))).toBe('Pairing timed out - try again');
  });

  it('có code nhưng không message → vẫn lộ mã ra để chẩn đoán', () => {
    expect(p.describeError({ code: '-1006', userInfo: { domain: 'sdk' } })).toBe('Pairing failed. [sdk:-1006]');
  });

  it('không code, không message → fallback có nghĩa (không "[object Object]")', () => {
    expect(p.describeError({})).toBe('Pairing failed.');
    expect(p.describeError(undefined)).toBe('Pairing failed.');
  });

  it('error dạng string → trả nguyên chuỗi', () => {
    expect(p.describeError('boom')).toBe('boom');
  });
});

describe('describeError + TuyaErrors (native có mặt)', () => {
  it('mã SỐ + không message → dùng explain của bảng mã, KHÔNG nối trùng "[domain:code]"', () => {
    const describe_ = jest.fn((code: string, domain: string) => `[${domain}:${code}] Token expired.`);
    const p = loadModule({ Tuya: {}, TuyaErrors: { describe: describe_ } });

    expect(p.describeError({ code: '-55', userInfo: { domain: 'sdk' } })).toBe('[sdk:-55] Token expired.');
    expect(describe_).toHaveBeenCalledWith('-55', 'sdk');
  });

  it('mã PHI-SỐ không bao giờ bị đẩy vào bảng mã (nguồn gốc của "Unknown error.")', () => {
    const describe_ = jest.fn(() => '[sdk:pairing_error] Unknown error.');
    const p = loadModule({ Tuya: {}, TuyaErrors: { describe: describe_ } });

    const out = p.describeError({ code: 'pairing_error', message: 'Ghép nối Wi-Fi thất bại.' });
    expect(describe_).not.toHaveBeenCalled();
    expect(out).not.toMatch(/Unknown error/i);
  });

  it('message native luôn thắng explain', () => {
    const describe_ = jest.fn(() => '[sdk:-55] Token expired.');
    const p = loadModule({ Tuya: {}, TuyaErrors: { describe: describe_ } });

    expect(p.describeError({ code: '-55', message: 'Chi tiết thật từ SDK' })).toBe(
      'Chi tiết thật từ SDK [sdk:-55]',
    );
  });
});
