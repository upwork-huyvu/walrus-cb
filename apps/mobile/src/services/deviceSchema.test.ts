import { parseTempRange, clampToRange, formatTemp, DEFAULT_TEMP_RANGE } from './deviceSchema';
import { DP } from './dp';

describe('deviceSchema.parseTempRange', () => {
  it('schema mảng + scale → giữ RAW min/max/step, ghi scale + chuẩn hoá unit', () => {
    const schema = JSON.stringify([
      { id: Number(DP.targetTemp), code: 'temp_set', property: { min: -100, max: 600, step: 5, scale: 1, unit: '℃' } },
    ]);
    expect(parseTempRange(schema)).toEqual({
      min: -100,
      max: 600,
      step: 5,
      scale: 1,
      unit: '°C',
    });
  });

  it('schema object keyed theo dpId (scale 0)', () => {
    const schema = JSON.stringify({
      [DP.targetTemp]: { id: Number(DP.targetTemp), property: { min: 3, max: 40, step: 1, scale: 0, unit: 'C' } },
    });
    expect(parseTempRange(schema)).toEqual({ min: 3, max: 40, step: 1, scale: 0, unit: '°C' });
  });

  it('ràng buộc nằm trực tiếp trên entry (không có property)', () => {
    const schema = JSON.stringify([{ dpId: DP.targetTemp, min: 0, max: 20 }]);
    const r = parseTempRange(schema);
    expect(r.min).toBe(0);
    expect(r.max).toBe(20);
    expect(r.step).toBe(DEFAULT_TEMP_RANGE.step); // thiếu step → default
  });

  it('thiếu DP target / JSON hỏng / thiếu min-max → DEFAULT', () => {
    expect(parseTempRange('not-json')).toEqual(DEFAULT_TEMP_RANGE);
    expect(parseTempRange('')).toEqual(DEFAULT_TEMP_RANGE);
    expect(parseTempRange(JSON.stringify([{ id: 999, property: { min: 1, max: 2 } }]))).toEqual(DEFAULT_TEMP_RANGE);
    expect(parseTempRange(JSON.stringify([{ id: Number(DP.targetTemp), property: { step: 1 } }]))).toEqual(
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
});
