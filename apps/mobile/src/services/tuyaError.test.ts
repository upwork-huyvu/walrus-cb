import { describeTuyaError, extractCode, extractDomain, isRetryableTuyaError } from './tuyaError';

// Classifier giả lập TuyaErrors của lib (vì lib không import được trong jest - native vắng).
const fakeClassifier = {
  describe: (code: string | number, _domain?: string) => {
    const map: Record<string, string> = {
      '-60': '[sdk:-60] Realtime (MQTT) connection lost - try again.',
      '-10001': '[sdk:-10001] Device is offline/not connected.',
      '-1400': '[sdk:-1400] DP not supported or invalid type/value.',
    };
    return map[String(code)] ?? `[sdk:${code}] Unknown error.`;
  },
  classify: (code: string | number) => ({ retryable: String(code) === '-60' }),
};

describe('tuyaError.extractCode', () => {
  it('trích code từ {code} (string/number), {userInfo.code}, và từ message', () => {
    expect(extractCode({ code: '-60' })).toBe('-60');
    expect(extractCode({ code: -10001 })).toBe('-10001');
    expect(extractCode({ userInfo: { code: 1402 } })).toBe('1402');
    expect(extractCode(new Error('publish failed: -1400'))).toBe('-1400');
    expect(extractCode('boom')).toBeUndefined();
  });
});

describe('tuyaError.extractDomain', () => {
  it('đọc domain hợp lệ, mặc định sdk', () => {
    expect(extractDomain({ domain: 'cloud' })).toBe('cloud');
    expect(extractDomain({ domain: 'xyz' })).toBe('sdk');
    expect(extractDomain('e')).toBe('sdk');
  });
});

describe('tuyaError.describeTuyaError', () => {
  it('có classifier + code → message đã bỏ tiền tố + cờ retryable', () => {
    const r = describeTuyaError({ code: '-60', domain: 'sdk' }, { classifier: fakeClassifier });
    expect(r.code).toBe('-60');
    expect(r.message).toBe('Realtime (MQTT) connection lost - try again.'); // bỏ "[sdk:-60] "
    expect(r.retryable).toBe(true);
  });

  it('offline (-10001) → message phân biệt, không retryable', () => {
    const r = describeTuyaError({ code: '-10001' }, { classifier: fakeClassifier });
    expect(r.message).toContain('offline');
    expect(r.retryable).toBe(false);
  });

  it('không có classifier (dev/native vắng) → message thô / fallback', () => {
    expect(describeTuyaError(new Error('raw native msg'), { classifier: null }).message).toBe('raw native msg');
    expect(describeTuyaError({}, { classifier: null }).message).toBe('Unable to reach the device. Please try again.');
  });
});

// --- REGRESSION (m1-fix-device-connect-error) ---
// Bug khách báo: màn Device Detail hiện "Unknown error." vì describeTuyaError() đẩy MỌI code vào bảng
// mã Tuya - mà bảng đó chỉ tra được mã SỐ; code phi-số ('no_device') luôn ra category 'unknown'.
describe('tuyaError: mã PHI-SỐ của bridge', () => {
  it('no_device → câu tiếng Anh rõ nghĩa + retryable, KHÔNG phải "Unknown error."', () => {
    const r = describeTuyaError(
      Object.assign(new Error('Không tìm thấy thiết bị'), { code: 'no_device' }),
      { classifier: fakeClassifier },
    );
    expect(r.code).toBe('no_device');
    expect(r.message).not.toMatch(/Unknown error/i);
    expect(r.message).toMatch(/not ready yet/i);
    expect(r.retryable).toBe(true);
  });

  it('timeout → retryable; init_error / ios_todo → KHÔNG retryable', () => {
    expect(describeTuyaError({ code: 'timeout' }, { classifier: fakeClassifier }).retryable).toBe(true);
    expect(describeTuyaError({ code: 'init_error' }, { classifier: fakeClassifier }).retryable).toBe(false);
    expect(describeTuyaError({ code: 'ios_todo' }, { classifier: fakeClassifier }).retryable).toBe(false);
  });

  it('mã phi-số LẠ (không có trong bảng) → giữ nguyên message native, không nuốt', () => {
    const r = describeTuyaError(
      Object.assign(new Error('weather sketch blew up'), { code: 'weather_sketch_error' }),
      { classifier: fakeClassifier },
    );
    expect(r.code).toBe('weather_sketch_error');
    expect(r.message).toBe('weather sketch blew up');
    expect(r.message).not.toMatch(/Unknown error/i);
  });

  it('mã SỐ lạ + có message native → ưu tiên message native thay vì "Unknown error."', () => {
    const r = describeTuyaError(
      Object.assign(new Error('cloud said no'), { code: '-9999' }),
      { classifier: fakeClassifier },
    );
    expect(r.message).toBe('cloud said no');
    expect(r.message).not.toMatch(/Unknown error/i);
  });
});

describe('tuyaError.extractCode: không cào số DƯƠNG từ message', () => {
  it('message timeout có "8000ms" KHÔNG được thành mã lỗi 8000', () => {
    const e = new Error('Device read timed out after 8000ms');
    expect(extractCode(e)).toBeUndefined();
    expect(describeTuyaError(e, { classifier: fakeClassifier }).message).toBe(
      'Device read timed out after 8000ms',
    );
  });

  it('vẫn cào được mã ÂM thật trong message', () => {
    expect(extractCode(new Error('publish failed: -10001'))).toBe('-10001');
  });

  it('đọc được domain nằm trong userInfo (shape TuyaReject của Android)', () => {
    expect(extractDomain({ userInfo: { domain: 'cloud' } })).toBe('cloud');
  });
});

describe('tuyaError.isRetryableTuyaError', () => {
  it('dùng chung logic với describeTuyaError', () => {
    expect(isRetryableTuyaError({ code: 'ios_todo' })).toBe(false);
  });
});
