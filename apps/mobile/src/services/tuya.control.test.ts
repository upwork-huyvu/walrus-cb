export {};

// Hợp đồng ĐIỀU KHIỂN trên payload THẬT của bồn g0cv1c (4 tính năng khách yêu cầu 2026-09-23):
// nhiệt độ · chu trình vệ sinh (DP khử trùng) · đèn · nguồn.
// Mục đích: chốt đúng DP id + đúng kiểu giá trị gửi xuống máy, và chứng minh KHÔNG bao giờ ghi bừa
// vào DP lạ khi thiếu map (sự cố 2026-07-24: placeholder trùng id với DP khác nghĩa).
// Số liệu lấy từ docs/research/tuya-icebath-dp-mapping.md (dump máy thật + bảng thuộc tính model).
const TEMP_HEX = '00280028ffffffffffffffffffffffff'; // DP 115 setting_temp: word0 = 4.0 °C
const RANGE_HEX = '00960014009600140096001400960014ffffffffffffffffffffffffffffffff'; // DP 114: 2.0–15.0 °C

const SNAPSHOT = {
  devId: 'dev-1',
  isOnline: true,
  dpsJson: JSON.stringify({
    '11': 0, //    fault
    '101': 64, //  sensor_1        → 6.4 °C
    '105': 430, // sensor_f_1      → 43.0 °F (KHÔNG được nhầm thành nhiệt độ hiển thị)
    '114': RANGE_HEX,
    '115': TEMP_HEX,
    '119': false, // setting_unit (ro)
    '121': true, //  setting_pwr  → nguồn ĐANG BẬT
    '122': false, // setting_clr  → khử trùng ĐANG TẮT
    '124': true, //  setting_4    → đèn ĐANG BẬT
  }),
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
    { dpId: '121', code: 'setting_pwr', mode: 'rw', type: 'bool' },
    { dpId: '122', code: 'setting_clr', mode: 'rw', type: 'bool' },
    { dpId: '124', code: 'setting_4', mode: 'rw', type: 'bool' },
  ]),
};

const nativeError = (code: string, message = code) => Object.assign(new Error(message), { code });

function load(native: Record<string, unknown>) {
  jest.resetModules();
  jest.doMock('@jimmy2k/react-native-turbo-tuya', () => ({
    Tuya: { getDeviceSnapshot: jest.fn().mockResolvedValue(SNAPSHOT), ...native },
  }));
  jest.doMock('./deviceLog', () => ({
    logDeviceSnapshot: jest.fn(),
    logDeviceReadAttempt: jest.fn(),
    logDpUpdate: jest.fn(),
  }));
  jest.doMock('../config/mock', () => ({ MOCK_DEVICES: false, MOCK_DEVICE_LIST: [], isMockDevId: () => false }));
  return require('./tuya');
}

/** Adapter đã đọc snapshot (đúng như lúc mở Device Detail) ⇒ có map DP + kiểu + payload raw. */
async function connected(native: Record<string, unknown> = {}) {
  const tuya = load({ publishDps: jest.fn().mockResolvedValue(undefined), ...native });
  await tuya.readDevice('dev-1');
  return tuya;
}

describe('readDevice trên bồn thật - nền của cả 4 tính năng', () => {
  it('map đúng DP: đèn 124, khử trùng 122, nguồn 121, nhiệt 101/115 (không dính DP độ F 105)', async () => {
    const tuya = load({});
    const snap = await tuya.readDevice('dev-1');

    expect(snap.currentTemp).toBe(64); // RAW, scale 1 ⇒ hiển thị 6.4 - KHÔNG phải 430 (°F)
    expect(snap.targetTemp).toBe(40); // word0 của DP raw 115 ⇒ 4.0 °C
    expect(snap.lightOn).toBe(true); // DP 124
    expect(snap.purifyOn).toBe(false); // DP 122
    expect(snap.powerOn).toBe(true); // DP 121
    expect(snap.isOnline).toBe(true);
  });

  it('caps = đúng những gì máy CÓ: power/light/purify bật, freeze KHÔNG có ⇒ UI ẩn nút', async () => {
    const tuya = load({});
    const snap = await tuya.readDevice('dev-1');
    expect(snap.caps).toEqual({ power: true, light: true, purify: true });
  });

  it('biên nhiệt độ đọc từ DP 114 (2.0–15.0 °C), scale mượn của cảm biến', async () => {
    const tuya = load({});
    const snap = await tuya.readDevice('dev-1');
    expect(snap.tempRange).toMatchObject({ min: 20, max: 150, scale: 1, unit: '°C' }); // ℃ đã chuẩn hoá
    expect(snap.tempRange.step).toBeGreaterThan(0);
  });
});

describe('① Nhiệt độ', () => {
  it('đặt 4.5 °C → ghi ĐÚNG word0 của DP 115, giữ nguyên mọi word khác', async () => {
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({ publishDps });
    await expect(tuya.setTargetTemp('dev-1', 45)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenCalledWith('dev-1', JSON.stringify({ '115': '002d0028ffffffffffffffffffffffff' }));
  });
});

describe('④ Đèn (DP 124 setting_4)', () => {
  it('bật/tắt gửi boolean THẬT vào đúng DP 124', async () => {
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({ publishDps });

    await expect(tuya.setLight('dev-1', false)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenLastCalledWith('dev-1', '{"124":false}');

    await expect(tuya.setLight('dev-1', true)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenLastCalledWith('dev-1', '{"124":true}');
  });

  it('máy từ chối → ok:false kèm lý do ĐỌC ĐƯỢC (không "Unknown error.") để UI hiện', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tuya = await connected({
      publishDps: jest.fn().mockRejectedValue(nativeError('publish_dps_error', 'device is offline')),
    });
    const res = await tuya.setLight('dev-1', true);
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toMatch(/Unknown error/i);
    warn.mockRestore();
  });
});

describe('② Chu trình vệ sinh (DP 122 setting_clr - cái cleanCycle bật/tắt)', () => {
  it('bật/tắt khử trùng gửi đúng DP 122', async () => {
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({ publishDps });

    await expect(tuya.setPurify('dev-1', true)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenLastCalledWith('dev-1', '{"122":true}');

    await expect(tuya.setPurify('dev-1', false)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenLastCalledWith('dev-1', '{"122":false}');
  });
});

describe('Nguồn (DP 121 setting_pwr)', () => {
  it('gửi đúng DP 121', async () => {
    const publishDps = jest.fn().mockResolvedValue(undefined);
    const tuya = await connected({ publishDps });
    await expect(tuya.setPower('dev-1', false)).resolves.toEqual({ ok: true });
    expect(publishDps).toHaveBeenLastCalledWith('dev-1', '{"121":false}');
  });
});

describe('An toàn: KHÔNG ghi bừa DP', () => {
  it('máy không có DP làm-lạnh → setFreeze bị từ chối, không publish gì', async () => {
    const publishDps = jest.fn();
    const tuya = await connected({ publishDps });
    const res = await tuya.setFreeze('dev-1', true);
    expect(res.ok).toBe(false);
    expect(publishDps).not.toHaveBeenCalled();
  });

  it('chưa đọc snapshot (map rỗng) → mọi lệnh bị từ chối, không chạm native', async () => {
    const publishDps = jest.fn();
    const tuya = load({ publishDps }); // KHÔNG readDevice
    expect((await tuya.setLight('dev-1', true)).ok).toBe(false);
    expect((await tuya.setPurify('dev-1', true)).ok).toBe(false);
    expect((await tuya.setPower('dev-1', true)).ok).toBe(false);
    expect((await tuya.setTargetTemp('dev-1', 45)).ok).toBe(false);
    expect(publishDps).not.toHaveBeenCalled();
  });
});
