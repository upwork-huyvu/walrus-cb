import {
  G0CV1C_PROFILE,
  profileFromSchema,
  resolveProfile,
  parseDps,
  formatDpValue,
  readWord0Hex,
  writeWord0Hex,
  type DpProp,
} from './deviceProfile';

const byId = (list: DpProp[], id: string) => list.find((p) => p.dpId === id)!;

describe('deviceProfile - accessMode quyết định show vs control', () => {
  it('profile g0cv1c: ro = show, rw = control', () => {
    // ro: sensor_1, sensor_f_1, fault, setting_unit, display, par_2, par_3
    expect(byId(G0CV1C_PROFILE, '101').rw).toBe(false);
    expect(byId(G0CV1C_PROFILE, '11').rw).toBe(false);
    // rw: setting_temp, setting_temp_range, setting_pwr, setting_clr, setting_4
    expect(byId(G0CV1C_PROFILE, '115').rw).toBe(true);
    expect(byId(G0CV1C_PROFILE, '121').rw).toBe(true);
    expect(byId(G0CV1C_PROFILE, '124').rw).toBe(true);
  });

  it('kiểu DP đúng', () => {
    expect(byId(G0CV1C_PROFILE, '101').type).toBe('value');
    expect(byId(G0CV1C_PROFILE, '115').type).toBe('raw');
    expect(byId(G0CV1C_PROFILE, '121').type).toBe('bool');
    expect(byId(G0CV1C_PROFILE, '11').type).toBe('bitmap');
  });
});

describe('profileFromSchema - schema live (getDeviceSnapshot)', () => {
  it('mode ro/rw → rw flag; property → scale/unit/label', () => {
    const schema = JSON.stringify([
      { dpId: '101', code: 'sensor_1', name: 'Temp', mode: 'ro', property: { type: 'value', scale: 1, unit: '℃' } },
      { dpId: '121', code: 'setting_pwr', name: 'Power', mode: 'rw', property: { type: 'bool' } },
      { dpId: '11', code: 'fault', name: 'Alarm', mode: 'ro', property: { type: 'bitmap', label: ['a', 'b'] } },
    ]);
    const p = profileFromSchema(schema);
    expect(byId(p, '101')).toMatchObject({ rw: false, type: 'value', scale: 1, unit: '℃' });
    expect(byId(p, '121')).toMatchObject({ rw: true, type: 'bool' });
    expect(byId(p, '11').label).toEqual(['a', 'b']);
  });

  it('cũng đọc được typeSpec/accessMode (dạng property table)', () => {
    const schema = JSON.stringify([
      { abilityId: 115, code: 'setting_temp', name: 'Temp set', accessMode: 'rw', typeSpec: { type: 'raw' } },
    ]);
    expect(byId(profileFromSchema(schema), '115')).toMatchObject({ rw: true, type: 'raw' });
  });

  it('schema rỗng/hỏng → []; resolveProfile fallback về g0cv1c', () => {
    expect(profileFromSchema('')).toEqual([]);
    expect(profileFromSchema('not-json')).toEqual([]);
    expect(resolveProfile('').length).toBe(G0CV1C_PROFILE.length);
  });
});

describe('formatDpValue', () => {
  const p = (over: Partial<DpProp>): DpProp => ({ dpId: '1', code: 'c', name: 'n', rw: false, type: 'value', ...over });
  it('value ÷scale + unit', () => {
    expect(formatDpValue(p({ type: 'value', scale: 1, unit: '℃' }), 64)).toBe('6.4 ℃');
    expect(formatDpValue(p({ type: 'value', scale: 0 }), 5)).toBe('5');
  });
  it('bool → ON/OFF; undefined → —', () => {
    expect(formatDpValue(p({ type: 'bool' }), true)).toBe('ON');
    expect(formatDpValue(p({ type: 'bool' }), false)).toBe('OFF');
    expect(formatDpValue(p({ type: 'bool' }), undefined)).toBe('—');
  });
  it('bitmap: 0 → OK; khác 0 → bit + label', () => {
    expect(formatDpValue(p({ type: 'bitmap', label: ['x', 'y'] }), 0)).toBe('OK (0)');
    expect(formatDpValue(p({ type: 'bitmap', label: ['x', 'y'] }), 0b10)).toBe('2 [y]');
  });
  it('raw/string → nguyên chuỗi', () => {
    expect(formatDpValue(p({ type: 'raw' }), '00280028')).toBe('00280028');
  });
});

describe('parseDps + raw word0', () => {
  it('parseDps', () => {
    expect(parseDps('{"121":true,"101":64}')).toEqual({ '121': true, '101': 64 });
    expect(parseDps('bad')).toEqual({});
  });
  it('readWord0Hex / writeWord0Hex (giữ nguyên phần còn lại)', () => {
    const TEMP = '00280028ffffffffffffffffffffffff';
    expect(readWord0Hex(TEMP)).toBe(40);
    expect(writeWord0Hex(TEMP, 75)).toBe('004b0028ffffffffffffffffffffffff');
    expect(readWord0Hex('ffff0000')).toBeNull(); // word0 = ffff (chưa đặt)
    expect(writeWord0Hex('abc', 1)).toBeNull(); // hex lẻ
  });
});
