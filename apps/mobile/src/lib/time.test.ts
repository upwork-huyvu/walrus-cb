import { parseWhen } from './time';

describe('parseWhen - an toàn Hermes (không dựa new Date(chuỗi dấu cách))', () => {
  it('Tuya "YYYY-MM-DD HH:mm:ss" (dấu cách) → epoch LOCAL đúng (ghép bằng constructor số)', () => {
    // So với constructor số → deterministic mọi engine (đây chính là điều Hermes làm được, new Date(str) thì không).
    const expected = new Date(2026, 6, 13, 17, 30, 45).getTime(); // month 0-based: 6 = July
    expect(parseWhen('2026-07-13 17:30:45')).toBe(expected);
  });

  it('"YYYY-MM-DD HH:mm" (không giây) → giây = 0', () => {
    expect(parseWhen('2026-07-13 09:00')).toBe(new Date(2026, 6, 13, 9, 0, 0).getTime());
  });

  it('ISO có Z (FCM backend) → epoch UTC đúng', () => {
    expect(parseWhen('2026-07-13T10:00:00.000Z')).toBe(Date.parse('2026-07-13T10:00:00.000Z'));
  });

  it('ISO có offset → đúng', () => {
    expect(parseWhen('2026-07-13T17:00:00+07:00')).toBe(Date.parse('2026-07-13T17:00:00+07:00'));
  });

  it('chuỗi Tuya luôn ra epoch > 0 (KHÔNG bao giờ NaN/0 như bug Hermes)', () => {
    expect(parseWhen('2026-07-13 17:00:00')).toBeGreaterThan(0);
  });

  it('rác / rỗng / null / undefined → 0', () => {
    expect(parseWhen('')).toBe(0);
    expect(parseWhen('   ')).toBe(0);
    expect(parseWhen('không phải ngày')).toBe(0);
    expect(parseWhen(null)).toBe(0);
    expect(parseWhen(undefined)).toBe(0);
    // @ts-expect-error - test đầu vào sai kiểu
    expect(parseWhen(12345)).toBe(0);
  });

  it('ngày sai (tháng 13) → constructor tự cuộn, vẫn số hợp lệ (không crash)', () => {
    expect(typeof parseWhen('2026-13-01 00:00:00')).toBe('number');
  });
});
