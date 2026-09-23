export {};

// setTargetTemp qua adapter với native giả. Snapshot đúng bồn thật g0cv1c (dạng iOS trả về) để
// readDevice resolve map/kiểu/payload raw như trên máy - rồi mới publish.
const TEMP_HEX = '00280028ffffffffffffffffffffffff'; // DP 115: word0 = 4.0 °C
const RANGE_HEX = '00960014009600140096001400960014ffffffffffffffffffffffffffffffff'; // DP 114
const SNAPSHOT = {
  devId: 'dev-1',
  isOnline: true,
  dpsJson: JSON.stringify({ '11': 0, '101': 64, '114': RANGE_HEX, '115': TEMP_HEX, '121': true, '122': false, '124': true }),
  dpCodesJson: JSON.stringify({
    '11': 'fault',
    '101': 'sensor_1',
    '105': 'sensor_f_1',
    '114': 'setting_temp_range',
    '115': 'setting_temp',
    '119': 'setting_unit',
    '121': 'setting_pwr',
    '122': 'setting_clr',
    '124': 'setting_4',
  }),
  schemaJson: JSON.stringify([
    { dpId: '101', code: 'sensor_1', mode: 'ro', type: 'obj', property: { type: 'value', min: -450, max: 999, step: 1, scale: 1, unit: '℃' } },
    { dpId: '114', code: 'setting_temp_range', mode: 'rw', type: 'raw', property: { type: 'raw' } },
    { dpId: '115', code: 'setting_temp', mode: 'rw', type: 'raw', property: { type: 'raw' } },
  ]),
};
// 4.0 → 4.5 °C: chỉ word0 đổi (0x002d = 45), mọi word khác giữ nguyên.
const EXPECTED_DPS = JSON.stringify({ '115': '002d0028ffffffffffffffffffffffff' });

/** Lỗi giống RN reject từ native: Error + `code`. */
const nativeError = (code: string, message = code) => Object.assign(new Error(message), { code });

function load(native: Record<string, unknown>) {
  jest.resetModules();
  jest.doMock('@jimmy-vu/react-native-turbo-tuya', () => ({
    Tuya: { getDeviceSnapshot: jest.fn().mockResolvedValue(SNAPSHOT), ...native },
  }));
  jest.doMock('./deviceLog', () => ({
    logDeviceSnapshot: jest.fn(),
    logDeviceReadAttempt: jest.fn(),
    logDpUpdate: jest.fn(),
  }));
  jest.doMock('../config/mock', () => ({
    MOCK_DEVICES: false,
    MOCK_DEVICE_LIST: [],
    isMockDevId: () => false,
  }));
  return require('./tuya');
}

/** Thông điệp UI của một lỗi - tính bằng chính `describeTuyaError` adapter dùng (không hardcode câu chữ). */
const mapped = (e: unknown): string => require('./tuyaError').describeTuyaError(e).message;

/** Adapter đã đọc snapshot (như lúc mở Device Detail) ⇒ có map DP + payload raw hiện tại. */
async function connected(native: Record<string, unknown>) {
  const tuya = load(native);
  await tuya.readDevice('dev-1');
  return tuya;
}

describe('setTargetTemp', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); // devLogError khi fallback/lỗi
  });
  afterEach(() => warn.mockRestore());

  it('native có ack → gửi DP 115 (chỉ đổi word0) qua publishDpsAwaitAck, không gọi publishDps', async () => {
    const publishDpsAwaitAck = jest.fn().mockResolvedValue(undefined);
    const publishDps = jest.fn();
    const tuya = await connected({ publishDpsAwaitAck, publishDps });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: true });
    expect(publishDpsAwaitAck).toHaveBeenCalledWith('dev-1', EXPECTED_DPS, 0);
    expect(publishDps).not.toHaveBeenCalled();
  });

  it('iOS stub (ios_todo) → vẫn gửi lệnh bằng publishDps thay vì chặn im lặng', async () => {
    const publishDpsAwaitAck = jest.fn().mockRejectedValue(nativeError('ios_todo'));
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({ publishDpsAwaitAck, publishDps });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenCalledWith('dev-1', EXPECTED_DPS);
  });

  it('Android todo (not_implemented) cũng lùi về publishDps', async () => {
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({
      publishDpsAwaitAck: jest.fn().mockRejectedValue(nativeError('not_implemented')),
      publishDps,
    });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenCalledWith('dev-1', EXPECTED_DPS);
  });

  it('thiết bị không xác nhận (ack_timeout) → KHÔNG gửi lại, trả lỗi để UI revert', async () => {
    const timeout = nativeError('ack_timeout', 'Không nhận dpsUpdate trong 8000ms');
    const publishDps = jest.fn();
    const tuya = await connected({ publishDpsAwaitAck: jest.fn().mockRejectedValue(timeout), publishDps });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: false, error: mapped(timeout) });
    expect(publishDps).not.toHaveBeenCalled();
  });

  it('fallback publishDps cũng lỗi → trả lỗi của lần gửi đó, không phải lỗi stub', async () => {
    const stub = nativeError('ios_todo');
    const offline = nativeError('publish_dps_error', 'device offline');
    const tuya = await connected({
      publishDpsAwaitAck: jest.fn().mockRejectedValue(stub),
      publishDps: jest.fn().mockRejectedValue(offline),
    });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: false, error: mapped(offline) });
    expect(mapped(offline)).not.toBe(mapped(stub));
  });

  it('lib cũ không có publishDpsAwaitAck → dùng publishDps', async () => {
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({ publishDps });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenCalledWith('dev-1', EXPECTED_DPS);
  });

  it('chưa đọc snapshot (chưa có map DP) → từ chối, không publish gì', async () => {
    const publishDpsAwaitAck = jest.fn();
    const publishDps = jest.fn();
    const tuya = load({ publishDpsAwaitAck, publishDps });
    const res = await tuya.setTargetTemp('dev-1', 45);
    expect(res.ok).toBe(false);
    expect(publishDpsAwaitAck).not.toHaveBeenCalled();
    expect(publishDps).not.toHaveBeenCalled();
  });
});
