import {
  parseSpecification,
  resolveMapFromCodes,
  rawToWords,
  wordsToBase64,
  readTargetWord,
  writeTargetWord,
  readTempRange,
  decodeStatus,
  buildCommands,
  MissingDpError,
  type DeviceSpec,
} from './device-dp';

// ── Dữ liệu THẬT của bồn (model g0cv1c) - xem docs/research/tuya-icebath-dp-mapping.md ──
// DP raw QUA CLOUD = base64 (App SDK = hex). base64 dưới đây tính từ chính payload hex thật.
const RANGE_B64 = 'AJYAFACWABQAlgAUAJYAFP////////////////////8='; // sensor 1–2: [15.0, 2.0] °C + °F lặp lại; 3–4 ẩn
const TEMP_B64 = 'ACgAKP///////////////w=='; // [40,40,ffff×6] → setpoint 4.0°C
const TEMP75_B64 = 'AEsAKP///////////////w=='; // sau khi đổi word0 → 7.5°C

// Specification giả lập theo bảng thuộc tính g0cv1c.
const SPEC_RESULT = {
  functions: [
    { code: 'setting_temp', type: 'Raw', values: '{}' },
    { code: 'setting_temp_range', type: 'Raw', values: '{}' },
    { code: 'setting_pwr', type: 'Boolean', values: '{}' },
    { code: 'setting_clr', type: 'Boolean', values: '{}' },
    { code: 'setting_4', type: 'Boolean', values: '{}' },
  ],
  status: [
    {
      code: 'sensor_1',
      type: 'Integer',
      values: '{"min":-450,"max":999,"scale":1,"step":1,"unit":"℃"}',
    },
    {
      code: 'sensor_f_1',
      type: 'Integer',
      values: '{"min":-490,"max":2100,"scale":1,"step":1,"unit":"°F"}',
    },
    { code: 'fault', type: 'Bitmap', values: '{"label":["fault1","fault2"]}' },
  ],
};

const spec: DeviceSpec = parseSpecification(SPEC_RESULT);

describe('parseSpecification - resolve map + kiểu + biên', () => {
  it('map theo code THẬT của bồn', () => {
    expect(spec.map).toEqual({
      currentTemp: 'sensor_1',
      currentTempF: 'sensor_f_1',
      targetTemp: 'setting_temp',
      tempRange: 'setting_temp_range',
      power: 'setting_pwr',
      light: 'setting_4',
      purify: 'setting_clr',
      fault: 'fault',
    });
  });

  it('kiểu DP + biên Integer (values là chuỗi JSON lồng)', () => {
    expect(spec.types['setting_temp']).toBe('Raw');
    expect(spec.types['sensor_1']).toBe('Integer');
    expect(spec.values['sensor_1']).toMatchObject({
      min: -450,
      max: 999,
      scale: 1,
      unit: '℃',
    });
  });

  it('code chuẩn được ưu tiên hơn code custom', () => {
    const s = parseSpecification({
      status: [
        { code: 'switch_led', type: 'Boolean' },
        { code: 'setting_4', type: 'Boolean' },
      ],
    });
    expect(s.map.light).toBe('switch_led');
  });

  it('resolveMapFromCodes (khi chỉ có status, không spec)', () => {
    expect(
      resolveMapFromCodes(['sensor_1', 'setting_temp', 'setting_pwr'])
        .currentTemp,
    ).toBe('sensor_1');
    expect(resolveMapFromCodes(['sensor_1']).power).toBeUndefined();
  });
});

describe('raw codec BASE64 (khác hex của App SDK)', () => {
  it('base64 ↔ word 16-bit big-endian', () => {
    expect(rawToWords(TEMP_B64)).toEqual([
      40, 40, 65535, 65535, 65535, 65535, 65535, 65535,
    ]);
    expect(wordsToBase64([40, 40])).toBe('ACgAKA==');
  });

  it('readTargetWord = word0; word ffff → null', () => {
    expect(readTargetWord(TEMP_B64)).toBe(40);
    expect(readTargetWord(wordsToBase64([0xffff, 40]))).toBeNull();
  });

  it('writeTargetWord đổi word0, GIỮ NGUYÊN word khác → base64', () => {
    expect(writeTargetWord(TEMP_B64, 75)).toBe(TEMP75_B64);
  });

  it('readTempRange đọc khối °C, bỏ qua sensor ffff', () => {
    expect(readTempRange(RANGE_B64)).toEqual({ min: 20, max: 150 });
  });

  it('readTempRange chỉ đọc cặp °C của từng sensor, không lấy cặp °F', () => {
    // sensor1: °C chưa đặt, °F = (200,10) · sensor2: °C = (150,20) → lấy sensor2.
    const s1Unset = wordsToBase64([0xffff, 0xffff, 200, 10, 150, 20]);
    expect(readTempRange(s1Unset)).toEqual({ min: 20, max: 150 });
    const onlyF = wordsToBase64([
      0xffff, 0xffff, 200, 10, 0xffff, 0xffff, 200, 10,
    ]);
    expect(readTempRange(onlyF)).toBeNull();
  });

  it('nhiệt độ âm dùng int16 bù 2', () => {
    const neg = wordsToBase64([0xffec]); // -20 raw = -2.0°C
    expect(readTargetWord(neg)).toBe(-20);
    expect(writeTargetWord(wordsToBase64([0]), -20)).toBe(neg);
  });

  it('auto-detect: hex vẫn đọc được nếu không phải base64 hợp lệ', () => {
    // "004b0028" độ dài 8, là hex hợp lệ; nhưng cũng là base64 hợp lệ → auto ưu tiên base64.
    expect(rawToWords('zz', 'hex')).toEqual([]);
    expect(rawToWords('00280028', 'hex')).toEqual([40, 40]);
  });
});

describe('decodeStatus - status thật → model hiển thị', () => {
  const status = [
    { code: 'sensor_1', value: 64 },
    { code: 'sensor_f_1', value: 430 },
    { code: 'setting_temp', value: TEMP_B64 },
    { code: 'setting_temp_range', value: RANGE_B64 },
    { code: 'setting_pwr', value: true },
    { code: 'setting_clr', value: false },
    { code: 'setting_4', value: true },
    { code: 'fault', value: 0 },
  ];

  it('nhiệt độ ÷scale, target đọc word0, range hiển thị', () => {
    const m = decodeStatus(status, spec);
    expect(m.currentTemp).toBeCloseTo(6.4);
    expect(m.targetTemp).toBeCloseTo(4.0);
    expect(m.tempRange).toEqual({ min: 2, max: 15, step: 0.5, unit: '°C' });
    expect(m.power).toBe(true);
    expect(m.light).toBe(true);
    expect(m.purify).toBe(false);
    expect(m.fault).toBe(0);
  });

  it('DP vắng → null, không nổ', () => {
    const m = decodeStatus([{ code: 'sensor_1', value: 64 }], spec);
    expect(m.currentTemp).toBeCloseTo(6.4);
    expect(m.targetTemp).toBeNull();
    expect(m.power).toBeNull();
  });
});

describe('buildCommands - thiếu DP thì NÉM lỗi, không gửi bừa', () => {
  it('nhiều bool 1 lần: đúng code + đúng thứ tự', () => {
    expect(buildCommands({ power: true, light: false }, spec)).toEqual([
      { code: 'setting_pwr', value: true },
      { code: 'setting_4', value: false },
    ]);
  });

  it('bool map đúng code từng chức năng', () => {
    expect(buildCommands({ power: true }, spec)).toEqual([
      { code: 'setting_pwr', value: true },
    ]);
    expect(buildCommands({ light: true }, spec)).toEqual([
      { code: 'setting_4', value: true },
    ]);
    expect(buildCommands({ purify: false }, spec)).toEqual([
      { code: 'setting_clr', value: false },
    ]);
  });

  it('target Raw: đọc raw hiện tại → ghi word0 → base64', () => {
    const cmds = buildCommands({ target: 7.5 }, spec, TEMP_B64);
    expect(cmds).toEqual([{ code: 'setting_temp', value: TEMP75_B64 }]);
  });

  it('target Raw mà THIẾU raw hiện tại → ném MissingDpError', () => {
    expect(() => buildCommands({ target: 7.5 }, spec)).toThrow(MissingDpError);
  });

  it('thiếu DP freeze/không có → ném MissingDpError', () => {
    const noPower = parseSpecification({
      status: [{ code: 'sensor_1', type: 'Integer' }],
    });
    expect(() => buildCommands({ power: true }, noPower)).toThrow(
      MissingDpError,
    );
    expect(() => buildCommands({ target: 5 }, noPower)).toThrow(MissingDpError);
  });

  it('target Integer thường (máy khác): gửi số raw ×scale', () => {
    const intSpec = parseSpecification({
      functions: [
        {
          code: 'temp_set',
          type: 'Integer',
          values: '{"min":30,"max":420,"scale":1,"step":5,"unit":"℃"}',
        },
      ],
      status: [
        {
          code: 'temp_current',
          type: 'Integer',
          values: '{"scale":1,"unit":"℃"}',
        },
      ],
    });
    expect(buildCommands({ target: 7.5 }, intSpec)).toEqual([
      { code: 'temp_set', value: 75 },
    ]);
  });
});
