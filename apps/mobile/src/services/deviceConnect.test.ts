import { CONNECT_RETRY_DELAYS_MS, readDeviceWithWarmup } from './deviceConnect';
import { timeoutError, type DeviceSnapshot } from './tuya';
import { describeTuyaError, isRetryableTuyaError } from './tuyaError';
import { DEFAULT_TEMP_RANGE } from './deviceSchema';

const SNAP: DeviceSnapshot = {
  currentTemp: 120,
  targetTemp: 60,
  lightOn: false,
  caps: { power: true, light: true, purify: true },
  isOnline: true,
  tempRange: DEFAULT_TEMP_RANGE,
};

/** Lỗi native đúng shape bridge reject: { code, message, domain }. */
const err = (code: string) => Object.assign(new Error(`native says ${code}`), { code, domain: 'sdk' });

function deps(read: jest.Mock) {
  const warmHome = jest.fn(async () => {});
  const sleep = jest.fn(async () => {});
  return { read, warmHome, sleep, all: { read, warmHome, sleep } };
}

describe('deviceConnect.readDeviceWithWarmup', () => {
  it('đọc được ngay → KHÔNG warm, KHÔNG chờ', async () => {
    const d = deps(jest.fn().mockResolvedValue(SNAP));
    await expect(readDeviceWithWarmup('dev-1', 42, d.all)).resolves.toBe(SNAP);
    expect(d.read).toHaveBeenCalledTimes(1);
    expect(d.warmHome).not.toHaveBeenCalled();
    expect(d.sleep).not.toHaveBeenCalled();
  });

  // Đây là ca của khách: vừa pair xong, cache SDK chưa có thiết bị.
  it('no_device lần đầu → nạp home data rồi đọc lại → thành công', async () => {
    const d = deps(jest.fn().mockRejectedValueOnce(err('no_device')).mockResolvedValue(SNAP));
    await expect(readDeviceWithWarmup('dev-1', 42, d.all)).resolves.toBe(SNAP);
    expect(d.read).toHaveBeenCalledTimes(2);
    expect(d.warmHome).toHaveBeenCalledWith(42);
    expect(d.sleep).toHaveBeenCalledWith(CONNECT_RETRY_DELAYS_MS[0]);
  });

  it('warm phải chạy TRƯỚC khi chờ (chờ mà cache vẫn rỗng thì đọc lại cũng vô ích)', async () => {
    const order: string[] = [];
    const read = jest.fn(async () => {
      order.push('read');
      if (read.mock.calls.length === 1) throw err('no_device');
      return SNAP;
    });
    await readDeviceWithWarmup('dev-1', 42, {
      read,
      warmHome: async () => { order.push('warm'); },
      sleep: async () => { order.push('sleep'); },
    });
    expect(order).toEqual(['read', 'warm', 'sleep', 'read']);
  });

  it('lỗi KHÔNG transient (ios_todo) → throw ngay, không warm, không đọc lại', async () => {
    const d = deps(jest.fn().mockRejectedValue(err('ios_todo')));
    await expect(readDeviceWithWarmup('dev-1', 42, d.all)).rejects.toMatchObject({ code: 'ios_todo' });
    expect(d.read).toHaveBeenCalledTimes(1);
    expect(d.warmHome).not.toHaveBeenCalled();
  });

  it('hết lượt → throw lỗi GỐC của lần cuối (không bọc lại, không nuốt)', async () => {
    const d = deps(jest.fn().mockRejectedValue(err('no_device')));
    await expect(readDeviceWithWarmup('dev-1', 42, d.all, [1, 2])).rejects.toMatchObject({
      code: 'no_device',
      message: 'native says no_device',
    });
    expect(d.read).toHaveBeenCalledTimes(3); // 1 lần đầu + 2 lần thử lại
  });

  it('thiếu homeId → vẫn thử lại nhưng bỏ qua warm', async () => {
    const d = deps(jest.fn().mockRejectedValueOnce(err('timeout')).mockResolvedValue(SNAP));
    await expect(readDeviceWithWarmup('dev-1', undefined, d.all)).resolves.toBe(SNAP);
    expect(d.warmHome).not.toHaveBeenCalled();
    expect(d.read).toHaveBeenCalledTimes(2);
  });

  it('no_home (home data chưa nạp) cũng được thử lại', async () => {
    const d = deps(jest.fn().mockRejectedValueOnce(err('no_home')).mockResolvedValue(SNAP));
    await expect(readDeviceWithWarmup('dev-1', 42, d.all)).resolves.toBe(SNAP);
    expect(d.read).toHaveBeenCalledTimes(2);
  });
});

describe('timeoutError (services/tuya.ts) ghép với đường retry', () => {
  it('mang code "timeout" ⇒ transient ⇒ được thử lại, và không bao giờ ra "Unknown error."', () => {
    const e = timeoutError('Device read', 8000);
    expect((e as unknown as { code: string }).code).toBe('timeout');
    expect(isRetryableTuyaError(e)).toBe(true);
    expect(describeTuyaError(e).message).not.toMatch(/Unknown error/i);
  });
});
