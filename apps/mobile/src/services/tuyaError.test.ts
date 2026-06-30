import { describeTuyaError, extractCode, extractDomain } from './tuyaError';

// Classifier giả lập TuyaErrors của lib (vì lib không import được trong jest — native vắng).
const fakeClassifier = {
  describe: (code: string | number, _domain?: string) => {
    const map: Record<string, string> = {
      '-60': '[sdk:-60] Mất kết nối realtime (MQTT) — thử lại.',
      '-10001': '[sdk:-10001] Thiết bị offline/không kết nối.',
      '-1400': '[sdk:-1400] DP không hỗ trợ hoặc sai kiểu/giá trị.',
    };
    return map[String(code)] ?? `[sdk:${code}] Lỗi không xác định.`;
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
    expect(r.message).toBe('Mất kết nối realtime (MQTT) — thử lại.'); // bỏ "[sdk:-60] "
    expect(r.retryable).toBe(true);
  });

  it('offline (-10001) → message phân biệt, không retryable', () => {
    const r = describeTuyaError({ code: '-10001' }, { classifier: fakeClassifier });
    expect(r.message).toContain('offline');
    expect(r.retryable).toBe(false);
  });

  it('không có classifier (dev/native vắng) → message thô / fallback', () => {
    expect(describeTuyaError(new Error('raw native msg'), { classifier: null }).message).toBe('raw native msg');
    expect(describeTuyaError({}, { classifier: null }).message).toBe('Có lỗi khi liên lạc với thiết bị. Vui lòng thử lại.');
  });
});
