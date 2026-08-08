import { parseTempRange, clampToRange, formatTemp, DEFAULT_TEMP_RANGE } from './deviceSchema';

const TARGET = '115';
const SENSOR = '101';

describe('deviceSchema.parseTempRange - nhánh DP raw (biên thật của bồn)', () => {
  // Bồn thật: setting_temp_range = 4 sensor × (trên 15.0, dưới 2.0) °C, khối °F chưa đặt.
  const RANGE_HEX = '00960014009600140096001400960014ffffffffffffffffffffffffffffffff';
  const schema = JSON.stringify([
    { dpId: SENSOR, code: 'sensor_1', property: { type: 'value', min: -450, max: 999, step: 1, scale: 1, unit: '℃' } },
    { dpId: TARGET, code: 'setting_temp', property: { type: 'raw' } },
  ]);

  it('lấy min/max từ DP raw, mượn scale+unit của DP cảm biến', () => {
    expect(parseTempRange(schema, { currentTemp: SENSOR, targetTemp: TARGET }, RANGE_HEX)).toEqual({
      min: 20, // 2.0 °C
      max: 150, // 15.0 °C
      step: 5, // 0.5 °C - mặc định khi DP raw không khai báo step
      scale: 1,
      unit: '°C',
    });
  });

  it('DP raw ưu tiên hơn schema của DP target', () => {
    const withBoth = JSON.stringify([
      { dpId: SENSOR, property: { type: 'value', scale: 1, unit: '℃' } },
      { dpId: TARGET, property: { type: 'value', min: 0, max: 999, step: 1, scale: 1 } },
    ]);
    const r = parseTempRange(withBoth, { currentTemp: SENSOR, targetTemp: TARGET }, RANGE_HEX);
    expect(r.min).toBe(20);
    expect(r.max).toBe(150);
  });

  it('hex hỏng / toàn ffff → rơi về nhánh schema, rồi DEFAULT', () => {
    expect(parseTempRange(schema, { currentTemp: SENSOR, targetTemp: TARGET }, 'zz')).toEqual(
      DEFAULT_TEMP_RANGE,
    );
    expect(
      parseTempRange(schema, { currentTemp: SENSOR, targetTemp: TARGET }, 'ffffffff'),
    ).toEqual(DEFAULT_TEMP_RANGE);
  });
});

describe('deviceSchema.parseTempRange - nhánh schema (DP value thường)', () => {
  it('schema mảng + scale → giữ RAW min/max/step, ghi scale + chuẩn hoá unit', () => {
    const schema = JSON.stringify([
      { id: 104, code: 'temp_set', property: { min: -100, max: 600, step: 5, scale: 1, unit: '℃' } },
    ]);
    expect(parseTempRange(schema, { targetTemp: '104' })).toEqual({
      min: -100,
      max: 600,
      step: 5,
      scale: 1,
      unit: '°C',
    });
  });

  it('schema object keyed theo dpId (scale 0)', () => {
    const schema = JSON.stringify({
      '104': { id: 104, property: { min: 3, max: 40, step: 1, scale: 0, unit: 'C' } },
    });
    expect(parseTempRange(schema, { targetTemp: '104' })).toEqual({
      min: 3,
      max: 40,
      step: 1,
      scale: 0,
      unit: '°C',
    });
  });

  it('đọc được cả dạng `typeSpec` của console Tuya', () => {
    const schema = JSON.stringify([
      { abilityId: 104, code: 'temp_set', typeSpec: { type: 'value', min: 30, max: 420, step: 1, scale: 1, unit: '℃' } },
    ]);
    const r = parseTempRange(schema, { targetTemp: '104' });
    expect(r.min).toBe(30);
    expect(r.max).toBe(420);
    expect(r.scale).toBe(1);
  });

  it('ràng buộc nằm trực tiếp trên entry (không có property)', () => {
    const schema = JSON.stringify([{ dpId: '104', min: 0, max: 20 }]);
    const r = parseTempRange(schema, { targetTemp: '104' });
    expect(r.min).toBe(0);
    expect(r.max).toBe(20);
    expect(r.step).toBe(DEFAULT_TEMP_RANGE.step); // thiếu step → default
  });

  it('thiếu DP target / JSON hỏng / thiếu min-max → DEFAULT', () => {
    expect(parseTempRange('not-json', { targetTemp: '104' })).toEqual(DEFAULT_TEMP_RANGE);
    expect(parseTempRange('', { targetTemp: '104' })).toEqual(DEFAULT_TEMP_RANGE);
    expect(parseTempRange(JSON.stringify([{ id: 999, property: { min: 1, max: 2 } }]), { targetTemp: '104' })).toEqual(
      DEFAULT_TEMP_RANGE,
    );
    expect(parseTempRange(JSON.stringify([{ id: 104, property: { step: 1 } }]), { targetTemp: '104' })).toEqual(
      DEFAULT_TEMP_RANGE,
    );
    // map rỗng (chưa resolve được DP nào) → DEFAULT, không nổ.
    expect(parseTempRange(JSON.stringify([{ id: 104, property: { min: 1, max: 2 } }]))).toEqual(
      DEFAULT_TEMP_RANGE,
    );
  });
});

describe('deviceSchema.clampToRange', () => {
  const range = { min: -3, max: 12, step: 1, scale: 0, unit: '°C' };
  it('kẹp dưới/trên biên, giữ giá trị trong biên', () => {
    expect(clampToRange(-10, range)).toBe(-3);
    expect(clampToRange(99, range)).toBe(12);
    expect(clampToRange(5, range)).toBe(5);
    expect(clampToRange(12, range)).toBe(12);
  });
});

describe('deviceSchema.formatTemp', () => {
  it('scale 0 → số nguyên + unit; null → -', () => {
    expect(formatTemp(6, DEFAULT_TEMP_RANGE)).toBe('6°C');
    expect(formatTemp(null, DEFAULT_TEMP_RANGE)).toBe('-');
  });
  it('scale 1 → chia 10, 1 chữ số thập phân', () => {
    const range = { min: -100, max: 600, step: 5, scale: 1, unit: '°C' };
    expect(formatTemp(60, range)).toBe('6.0°C');
    expect(formatTemp(-15, range)).toBe('-1.5°C');
  });
  it('bồn thật: raw 64 → "6.4°C", target raw 40 → "4.0°C"', () => {
    const range = { min: 20, max: 150, step: 5, scale: 1, unit: '°C' };
    expect(formatTemp(64, range)).toBe('6.4°C');
    expect(formatTemp(40, range)).toBe('4.0°C');
  });
});
