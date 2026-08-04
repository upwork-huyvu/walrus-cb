// Profile DP để màn test tự sinh UI: accessMode `ro` → chỉ SHOW trạng thái, `rw` → cho ĐIỀU KHIỂN.
// Nguồn: ưu tiên schema LIVE từ getDeviceSnapshot (tổng quát mọi máy); thiếu → dùng profile g0cv1c
// (bồn hiện tại) nhúng sẵn từ property table Tuya. Giá trị hiện tại luôn lấy từ dps live.

export type DpType = 'bool' | 'value' | 'raw' | 'bitmap' | 'string' | 'enum';

export type DpProp = {
  dpId: string;
  code: string;
  name: string;
  rw: boolean; // accessMode === 'rw'
  type: DpType;
  scale?: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  label?: string[]; // bitmap
};

/** Profile bồn g0cv1c - từ bảng thuộc tính Tuya (docs/research/tuya-icebath-dp-mapping.md). */
export const G0CV1C_PROFILE: DpProp[] = [
  { dpId: '11', code: 'fault', name: 'Alarm', rw: false, type: 'bitmap', label: ['fault1', 'fault2', 'fault3', 'fault4'] },
  { dpId: '101', code: 'sensor_1', name: 'Temperature', rw: false, type: 'value', min: -450, max: 999, scale: 1, step: 1, unit: '℃' },
  { dpId: '105', code: 'sensor_f_1', name: 'Temperature (°F)', rw: false, type: 'value', min: -490, max: 2100, scale: 1, step: 1, unit: '°F' },
  { dpId: '114', code: 'setting_temp_range', name: 'Temperature Range Settings', rw: true, type: 'raw' },
  { dpId: '115', code: 'setting_temp', name: 'Temperature Setting', rw: true, type: 'raw' },
  { dpId: '119', code: 'setting_unit', name: 'Temperature Unit', rw: false, type: 'bool' },
  { dpId: '120', code: 'display', name: 'Display Control', rw: false, type: 'raw' },
  { dpId: '121', code: 'setting_pwr', name: 'Power', rw: true, type: 'bool' },
  { dpId: '122', code: 'setting_clr', name: 'Disinfection', rw: true, type: 'bool' },
  { dpId: '124', code: 'setting_4', name: 'Lighting', rw: true, type: 'bool' },
  { dpId: '125', code: 'par_2', name: 'Parameter', rw: false, type: 'string' },
  { dpId: '126', code: 'par_3', name: 'Raw Parameter', rw: false, type: 'raw' },
];

const num = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined;

const normType = (t: unknown): DpType => {
  const s = String(t ?? '').toLowerCase();
  return s === 'bool' || s === 'value' || s === 'raw' || s === 'bitmap' || s === 'string' || s === 'enum'
    ? (s as DpType)
    : 'raw';
};

/** Parse schema live (getDeviceSnapshot.schemaJson) → DpProp[]. Thiếu/hỏng → []. */
export function profileFromSchema(schemaJson: string): DpProp[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaJson || '');
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? Object.values(parsed) : [];
  const out: DpProp[] = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, any>;
    const dpId = String(o.dpId ?? o.id ?? o.abilityId ?? '');
    if (!dpId) continue;
    const p = (o.property ?? o.typeSpec ?? {}) as Record<string, any>;
    const mode = String(o.mode ?? o.accessMode ?? '').toLowerCase();
    out.push({
      dpId,
      code: String(o.code ?? ''),
      name: String(o.name ?? o.code ?? dpId),
      rw: mode === 'rw' || mode === 'wr',
      type: normType(p.type ?? o.type),
      scale: num(p.scale),
      unit: typeof p.unit === 'string' ? p.unit : undefined,
      min: num(p.min),
      max: num(p.max),
      step: num(p.step),
      label: Array.isArray(p.label) ? p.label.map(String) : undefined,
    });
  }
  return out;
}

/** Profile để render: schema live nếu có, không thì profile g0cv1c nhúng sẵn. */
export function resolveProfile(schemaJson: string): DpProp[] {
  const live = profileFromSchema(schemaJson);
  return live.length > 0 ? live : G0CV1C_PROFILE;
}

/** dpsJson (getDeviceSnapshot) → { dpId: value }. */
export function parseDps(dpsJson: string): Record<string, unknown> {
  try {
    const p = JSON.parse(dpsJson || '{}');
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Giá trị hiển thị theo kiểu DP. */
export function formatDpValue(prop: DpProp, value: unknown): string {
  if (value === undefined || value === null) return '—';
  switch (prop.type) {
    case 'bool':
      return value === true ? 'ON' : value === false ? 'OFF' : String(value);
    case 'value': {
      const n = num(value);
      if (n == null) return String(value);
      const scale = prop.scale ?? 0;
      const disp = n / Math.pow(10, scale);
      return `${scale > 0 ? disp.toFixed(scale) : disp}${prop.unit ? ` ${prop.unit}` : ''}`;
    }
    case 'bitmap': {
      const n = num(value);
      if (n == null) return String(value);
      if (n === 0) return 'OK (0)';
      const bits: string[] = [];
      for (let i = 0; i < 16; i++) if (n & (1 << i)) bits.push(prop.label?.[i] ?? `bit${i}`);
      return `${n} [${bits.join(', ')}]`;
    }
    default:
      return String(value);
  }
}

// ── Raw temp helper (setting_temp: 8 word 16-bit big-endian hex; word0 = setpoint °C sensor1) ──
const toSigned = (w: number): number => (w >= 0x8000 ? w - 0x10000 : w);

export function readWord0Hex(hex: string): number | null {
  const s = String(hex ?? '').trim();
  if (s.length < 4 || !/^[0-9a-fA-F]+$/.test(s)) return null;
  const w = parseInt(s.slice(0, 4), 16);
  return w === 0xffff ? null : toSigned(w);
}

/** Ghi word0 (raw), GIỮ NGUYÊN phần còn lại. Hex hỏng → null. */
export function writeWord0Hex(hex: string, raw: number): string | null {
  const s = String(hex ?? '').trim();
  if (s.length < 4 || s.length % 4 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return null;
  const w = (Math.round(raw) & 0xffff).toString(16).padStart(4, '0');
  return w + s.slice(4);
}
