import { formatMac, parseDeviceInfo } from './deviceInfo';

// rawJson THẬT của bồn g0cv1c: iOS và Android trả khác field nhau (xem docs/research/tuya-icebath-dp-mapping.md).
const IOS_RAW = JSON.stringify({
  devId: '9beceda61448a0fdd54w73',
  name: 'Walrus Pro 2',
  productId: 'eht82h7rvizavwpf',
  verSw: '2.7.7',
  mac: 'd8c80c31d5ef',
  timezoneId: 'Europe/Madrid',
  isOnline: true,
  isLocalOnline: true,
  isShare: false,
  pv: '2.2',
  bv: 40,
});
const ANDROID_RAW = JSON.stringify({
  devId: '9beceda61448a0fdd54w73',
  name: 'Walrus Pro 2',
  productId: 'eht82h7rvizavwpf',
  verSw: '2.7.7',
  mac: 'd8:c8:0c:31:d5:ef',
  uiType: 'xyz',
  ownerId: '123',
  isOnline: false,
  isLocalOnline: false,
  isShare: false,
});

const labels = (raw: string): string[] => parseDeviceInfo(raw).rows.map((r) => r.label);
const valueOf = (raw: string, label: string): string | undefined =>
  parseDeviceInfo(raw).rows.find((r) => r.label === label)?.value;

describe('parseDeviceInfo', () => {
  it('payload iOS: đủ dòng + tên + online', () => {
    const info = parseDeviceInfo(IOS_RAW);
    expect(info.name).toBe('Walrus Pro 2');
    expect(info.online).toBe(true);
    expect(labels(IOS_RAW)).toEqual([
      'Status',
      'Connection',
      'Model',
      'Firmware',
      'MAC address',
      'Time zone',
      'Device ID',
    ]);
    expect(valueOf(IOS_RAW, 'Connection')).toBe('Local network');
    expect(valueOf(IOS_RAW, 'MAC address')).toBe('D8:C8:0C:31:D5:EF');
  });

  it('payload Android: thiếu time zone thì BỎ dòng, offline thì không hiện kênh kết nối', () => {
    const info = parseDeviceInfo(ANDROID_RAW);
    expect(info.online).toBe(false);
    expect(labels(ANDROID_RAW)).toEqual(['Status', 'Model', 'Firmware', 'MAC address', 'Device ID']);
    expect(valueOf(ANDROID_RAW, 'Status')).toBe('Offline');
  });

  it('online qua cloud (không LAN) → "Cloud"', () => {
    const raw = JSON.stringify({ devId: 'x', isOnline: true, isLocalOnline: false });
    expect(valueOf(raw, 'Connection')).toBe('Cloud');
  });

  it('thiết bị được chia sẻ → thêm dòng Sharing', () => {
    const raw = JSON.stringify({ devId: 'x', isOnline: true, isShare: true });
    expect(valueOf(raw, 'Sharing')).toBe('Shared with you');
  });

  it('payload rỗng / hỏng → không dòng nào, không "undefined"', () => {
    for (const raw of ['', '{}', 'không-phải-json', 'null']) {
      const info = parseDeviceInfo(raw);
      expect(info.rows).toEqual([]);
      expect(info.name).toBe('');
      expect(info.online).toBeNull();
    }
  });

  it('field lạ kiểu không phải chuỗi thì bỏ qua, không đổ vỡ', () => {
    const raw = JSON.stringify({ devId: 'x', productId: { a: 1 }, verSw: 42, mac: null });
    expect(labels(raw)).toEqual(['Firmware', 'Device ID']);
    expect(valueOf(raw, 'Firmware')).toBe('42');
  });
});

describe('formatMac', () => {
  it('12 ký tự hex → chèn dấu hai chấm + viết hoa', () => {
    expect(formatMac('d8c80c31d5ef')).toBe('D8:C8:0C:31:D5:EF');
  });

  it('đã có dấu hai chấm / độ dài lạ → chỉ viết hoa, không cắt bừa', () => {
    expect(formatMac('d8:c8:0c:31:d5:ef')).toBe('D8:C8:0C:31:D5:EF');
    expect(formatMac('abc')).toBe('ABC');
    expect(formatMac('')).toBe('');
    expect(formatMac(null)).toBe('');
  });
});
