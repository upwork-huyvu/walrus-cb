import {
  parseDeviceDps,
  buildTempDps,
  buildLightDps,
  buildPurifyDps,
  buildFreezeDps,
  buildPowerDps,
  parseDpCodes,
  resolveDpMap,
  resolveDpKinds,
  setDpMap,
  getDpMap,
  cacheRawDps,
  getRawDp,
  setDpCodes,
  getCodeById,
  readRawSlot,
  writeRawSlot,
  readRawTempRange,
} from './dp';

// ───── Dữ liệu THẬT của bồn (log [DEVICE] 2026-07-24, model g0cv1c) ─────
// Giữ nguyên để làm test hồi quy: chính bộ DP này từng bị map sai (105=°F đọc thành nhiệt độ
// hiện tại, 101=°C đọc thành đèn). Xem docs/research/tuya-icebath-dp-mapping.md
const REAL_DP_CODES = JSON.stringify({
  '120': 'display',
  '119': 'setting_unit',
  '11': 'fault',
  '101': 'sensor_1',
  '126': 'par_3',
  '115': 'setting_temp',
  '121': 'setting_pwr',
  '124': 'setting_4',
  '122': 'setting_clr',
  '105': 'sensor_f_1',
  '125': 'par_2',
  '114': 'setting_temp_range',
});

const REAL_SCHEMA = JSON.stringify([
  { dpId: '11', code: 'fault', mode: 'ro', property: { type: 'bitmap' } },
  { dpId: '101', code: 'sensor_1', mode: 'ro', property: { type: 'value', min: -450, max: 999, step: 1, scale: 1, unit: '℃' } },
  { dpId: '105', code: 'sensor_f_1', mode: 'ro', property: { type: 'value', min: -490, max: 2100, step: 1, scale: 1, unit: '°F' } },
  { dpId: '114', code: 'setting_temp_range', mode: 'rw', property: { type: 'raw' } },
  { dpId: '115', code: 'setting_temp', mode: 'rw', property: { type: 'raw' } },
  { dpId: '119', code: 'setting_unit', mode: 'ro', property: { type: 'bool' } },
  { dpId: '120', code: 'display', mode: 'ro', property: { type: 'raw' } },
  { dpId: '121', code: 'setting_pwr', mode: 'rw', property: { type: 'bool' } },
  { dpId: '122', code: 'setting_clr', mode: 'rw', property: { type: 'bool' } },
  { dpId: '124', code: 'setting_4', mode: 'rw', property: { type: 'bool' } },
  { dpId: '125', code: 'par_2', mode: 'ro', property: { type: 'string' } },
  { dpId: '126', code: 'par_3', mode: 'ro', property: { type: 'raw' } },
]);

const RANGE_HEX = '00960014009600140096001400960014ffffffffffffffffffffffffffffffff';
const TEMP_HEX = '00280028ffffffffffffffffffffffff';

const REAL_DPS = JSON.stringify({
  '11': 0,
  '101': 64,
  '105': 430,
  '114': RANGE_HEX,
  '115': TEMP_HEX,
  '119': false,
  '120': '00000000',
  '121': true,
  '122': false,
  '124': true,
  '125': '',
  '126': '',
});

describe('parseDpCodes - chịu mọi dạng dpCodesJson của SDK', () => {
  it('dạng id→code {"104":"temp_set"}', () => {
    expect(parseDpCodes('{"104":"temp_set","105":"temp_current"}')).toEqual({
      temp_set: '104',
      temp_current: '105',
    });
  });

  it('dạng code→id {"temp_set":"104"}', () => {
    expect(parseDpCodes('{"temp_set":"104"}')).toEqual({ temp_set: '104' });
  });

  it('dạng mảng [{dpId, code}] / [{id, code}]', () => {
    expect(parseDpCodes('[{"dpId":"104","code":"temp_set"},{"id":"101","code":"switch_led"}]')).toEqual({
      temp_set: '104',
      switch_led: '101',
    });
  });

  it('code không phân biệt hoa/thường; json rác/rỗng → {}', () => {
    expect(parseDpCodes('{"TEMP_SET":"9"}')).toEqual({ temp_set: '9' });
    expect(parseDpCodes('not-json')).toEqual({});
    expect(parseDpCodes('')).toEqual({});
  });
});

describe('resolveDpMap - KHÔNG đoán DP id', () => {
  it('khớp code chuẩn → dùng id thật của thiết bị', () => {
    const map = resolveDpMap(
      '{"20":"switch_led","24":"temp_set","25":"temp_current","26":"refrigeration"}',
    );
    expect(map.targetTemp).toBe('24');
    expect(map.currentTemp).toBe('25');
    expect(map.light).toBe('20');
    expect(map.freeze).toBe('26');
  });

  it('code nào không có → BỎ TRỐNG (không fallback placeholder)', () => {
    const map = resolveDpMap('{"24":"temp_set"}');
    expect(map.targetTemp).toBe('24');
    expect(map.purify).toBeUndefined();
    expect(map.light).toBeUndefined();
  });

  it('dpCodes rỗng → map rỗng hoàn toàn', () => {
    expect(resolveDpMap('')).toEqual({});
  });

  it('code chuẩn được ưu tiên hơn code custom model-riêng', () => {
    // Máy vừa có switch_led (chuẩn) vừa có setting_4 (custom) → phải chọn chuẩn.
    const map = resolveDpMap('{"20":"switch_led","124":"setting_4"}');
    expect(map.light).toBe('20');
  });
});

describe('bồn thật (model g0cv1c) - hồi quy bug map sai', () => {
  const map = resolveDpMap(REAL_DP_CODES);
  const kinds = resolveDpKinds(map, REAL_SCHEMA);

  it('nhiệt độ hiện tại là DP °C (101), KHÔNG phải DP °F (105)', () => {
    expect(map.currentTemp).toBe('101');
    expect(map.currentTempF).toBe('105');
  });

  it('đèn = setting_4 (124) và lọc = setting_clr (122); không có DP xả đá', () => {
    expect(map.light).toBe('124');
    expect(map.purify).toBe('122');
    expect(map.freeze).toBeUndefined();
  });

  it('target temp / biên / nguồn / lỗi', () => {
    expect(map.targetTemp).toBe('115');
    expect(map.tempRange).toBe('114');
    expect(map.power).toBe('121');
    expect(map.fault).toBe('11');
  });

  it('kiểu DP lấy từ schema', () => {
    expect(kinds.targetTemp).toBe('raw');
    expect(kinds.currentTemp).toBe('value');
    expect(kinds.light).toBe('bool');
  });

  it('parse dps thật → 6.4°C hiện tại (raw 64), target 4.0°C (raw 40)', () => {
    expect(parseDeviceDps(REAL_DPS, map, kinds)).toEqual({
      currentTemp: 64, // 6.4 °C sau khi chia scale 1
      targetTemp: 40, // 4.0 °C, đọc từ word 0 của DP raw 115
      lightOn: true,
      purifyOn: false,
      freezeOn: null,
      powerOn: true,
      fault: 0,
    });
  });

  it('đổi target 4.0 → 7.5 °C: chỉ word 0 đổi, các word khác GIỮ NGUYÊN', () => {
    const dps = buildTempDps(75, map, TEMP_HEX, kinds);
    expect(dps).toBe(JSON.stringify({ '115': '004b0028ffffffffffffffffffffffff' }));
  });

  it('biên thật từ DP 114 = 2.0–15.0 °C', () => {
    expect(readRawTempRange(RANGE_HEX)).toEqual({ min: 20, max: 150 });
  });
});

describe('DP raw - đọc/ghi slot 16-bit big-endian', () => {
  it('đọc slot; slot ffff (chưa dùng) → null', () => {
    expect(readRawSlot(TEMP_HEX, 0)).toBe(40);
    expect(readRawSlot(TEMP_HEX, 1)).toBe(40);
    expect(readRawSlot(TEMP_HEX, 2)).toBeNull();
    expect(readRawSlot(TEMP_HEX, 99)).toBeNull();
  });

  it('nhiệt độ âm dùng int16 bù 2', () => {
    expect(readRawSlot('ffec', 0)).toBe(-20); // -2.0 °C
    expect(writeRawSlot('0000', 0, -20)).toBe('ffec');
  });

  it('hex hỏng / lẻ word → null (caller phải từ chối publish)', () => {
    expect(readRawSlot('abc', 0)).toBeNull();
    expect(readRawSlot('zzzz', 0)).toBeNull();
    expect(writeRawSlot('abc', 0, 1)).toBeNull();
    expect(writeRawSlot('', 0, 1)).toBeNull();
    expect(writeRawSlot(TEMP_HEX, 99, 1)).toBeNull();
  });

  it('payload raw toàn CHỮ SỐ vẫn phải decode kiểu raw (không đọc thành number)', () => {
    // "00280028" hợp lệ với /^\d+$/ → bản cũ đọc thành 280028. Kiểu từ schema chặn được.
    const map = { targetTemp: '115' };
    expect(parseDeviceDps('{"115":"00280028"}', map, { targetTemp: 'raw' }).targetTemp).toBe(40);
  });

  it('readRawTempRange chỉ đọc cặp °C của từng sensor, bỏ qua sensor chưa đặt', () => {
    // sensor1: °C chưa đặt, °F = (200,10) · sensor2: °C = (150,20) → lấy sensor2.
    expect(readRawTempRange('ffffffff00c8000a00960014')).toEqual({ min: 20, max: 150 });
    expect(readRawTempRange('ffffffffffffffff')).toBeNull();
    // Cặp °F (word 2/3 của mỗi sensor) KHÔNG bao giờ được dùng làm biên °C.
    expect(readRawTempRange('ffffffff00c8000affffffff00c8000a')).toBeNull();
  });
});

describe('build*Dps - thiếu DP thì KHÔNG publish', () => {
  const map = resolveDpMap(REAL_DP_CODES);

  it('DP có → JSON publish đúng id', () => {
    expect(buildLightDps(true, map)).toBe(JSON.stringify({ '124': true }));
    expect(buildPurifyDps(true, map)).toBe(JSON.stringify({ '122': true }));
    expect(buildPowerDps(false, map)).toBe(JSON.stringify({ '121': false }));
  });

  it('DP vắng → null', () => {
    expect(buildFreezeDps(true, map)).toBeNull();
    expect(buildLightDps(true, {})).toBeNull();
    expect(buildTempDps(6, {})).toBeNull();
  });

  it('DP raw mà chưa có payload gốc → null (không gửi số vào DP raw)', () => {
    expect(buildTempDps(60, map, undefined, { targetTemp: 'raw' })).toBeNull();
  });

  it('DP value thường → gửi số', () => {
    const m = resolveDpMap('{"24":"temp_set"}');
    expect(buildTempDps(9, m)).toBe(JSON.stringify({ '24': 9 }));
  });
});

describe('cache theo devId', () => {
  it('setDpMap/getDpMap; devId lạ → map RỖNG (không đoán)', () => {
    setDpMap('dev-A', resolveDpMap('{"24":"temp_set"}'));
    expect(getDpMap('dev-A').targetTemp).toBe('24');
    expect(getDpMap('dev-khong-biet')).toEqual({});
  });

  it('cacheRawDps chỉ giữ value kiểu chuỗi; getRawDp trả payload mới nhất', () => {
    cacheRawDps('dev-B', REAL_DPS);
    expect(getRawDp('dev-B', '115')).toBe(TEMP_HEX);
    expect(getRawDp('dev-B', '101')).toBeUndefined(); // 101 là số → không phải raw
    expect(getRawDp('dev-B', undefined)).toBeUndefined();
    // Update realtime ghi đè payload cũ.
    cacheRawDps('dev-B', '{"115":"004b0028ffffffffffffffffffffffff"}');
    expect(getRawDp('dev-B', '115')).toBe('004b0028ffffffffffffffffffffffff');
  });

  it('setDpCodes/getCodeById → tra ngược dpId sang code cho log realtime', () => {
    setDpCodes('dev-C', REAL_DP_CODES);
    expect(getCodeById('dev-C')['122']).toBe('setting_clr');
    expect(getCodeById('dev-khong-biet')).toEqual({});
  });
});
