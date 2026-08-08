import {
  clearPairingLog,
  dumpPairingLog,
  getPairingLog,
  logPairing,
  redactValue,
} from './pairingLog';

beforeEach(() => clearPairingLog());

describe('redactValue - không bao giờ lộ secret ra log', () => {
  it.each(['password', 'Password', 'pwd', 'pass', 'token', 'secret', 'apiKey', 'api_key'])(
    'che khoá %s nhưng giữ độ dài',
    (key) => {
      expect(redactValue(key, 'hunter2')).toBe('<redacted len=7>');
    },
  );

  it('phân biệt "chưa nhập" với "nhập rồi mà sai"', () => {
    expect(redactValue('password', '')).toBe('<empty>');
    expect(redactValue('password', null)).toBe('<empty>');
    expect(redactValue('password', 'x')).toBe('<redacted len=1>');
  });

  it('không đụng vào khoá thường', () => {
    expect(redactValue('ssid', 'Can March')).toBe('Can March');
    expect(redactValue('homeId', 123)).toBe(123);
  });
});

describe('logPairing', () => {
  it('password không bao giờ xuất hiện nguyên văn trong buffer lẫn dump', () => {
    logPairing('wifi.start', { ssid: 'Can March', password: 'sieu-bi-mat' });

    expect(JSON.stringify(getPairingLog())).not.toContain('sieu-bi-mat');
    expect(dumpPairingLog()).not.toContain('sieu-bi-mat');
    expect(dumpPairingLog()).toContain('<redacted len=11>');
    expect(dumpPairingLog()).toContain('Can March'); // ssid KHÔNG phải secret
  });

  it('bỏ qua key undefined (không làm bẩn log)', () => {
    logPairing('x', { a: 1, b: undefined });
    expect(getPairingLog()[0]?.data).toEqual({ a: 1 });
  });

  it('ring buffer chặn ở 120 entry, giữ cái MỚI nhất', () => {
    for (let i = 0; i < 200; i++) logPairing(`e${i}`);
    const log = getPairingLog();
    expect(log).toHaveLength(120);
    expect(log[0]?.event).toBe('e80');
    expect(log[119]?.event).toBe('e199');
  });
});

describe('dumpPairingLog', () => {
  it('buffer rỗng → chuỗi có nghĩa, không nổ', () => {
    expect(dumpPairingLog()).toContain('(no events recorded)');
  });

  it('có header môi trường + timeline tương đối', () => {
    logPairing('wifi.start', { mode: 'EZ' });
    logPairing('wifi.error', { code: '-55' });
    const out = dumpPairingLog();

    expect(out).toContain('Walrus pairing diagnostics');
    expect(out).toContain('platform:');
    expect(out).toContain('events: 2');
    expect(out).toContain('wifi.start');
    expect(out).toContain('"mode":"EZ"');
    expect(out).toContain('+     0ms'); // event đầu luôn ở mốc 0
  });

  it('clearPairingLog dọn sạch', () => {
    logPairing('x');
    clearPairingLog();
    expect(getPairingLog()).toHaveLength(0);
  });
});
