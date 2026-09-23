// Codec DP phía CLOUD (khác App SDK phía mobile) cho ice bath.
//
// ⚠️ Khác biệt cốt tử với apps/mobile/src/services/dp.ts:
//   - Cloud điều khiển theo `code` (standard instruction), KHÔNG theo dpId.
//   - DP kiểu Raw qua Cloud = BASE64 (App SDK dùng hex). Xem docs/research/tuya-cloud-device-control.md.
// Vì thế file này viết MỚI, không tái dùng code mobile. Giữ cùng LOGIC (word0 = setpoint, giữ nguyên
// các word khác) nhưng khác lớp mã hoá.
//
// Map DP của bồn (model g0cv1c): xem docs/research/tuya-icebath-dp-mapping.md.

/** Chức năng app quan tâm; thiếu = thiết bị không có DP đó. */
export type DpFn =
  | 'currentTemp'
  | 'currentTempF'
  | 'targetTemp'
  | 'tempRange'
  | 'power'
  | 'light'
  | 'purify'
  | 'fault';

/** function → code THẬT của thiết bị. Thiếu key = không có chức năng đó (đừng gửi lệnh). */
export type DpMap = Partial<Record<DpFn, string>>;

/** code → kiểu DP (Boolean|Integer|Enum|String|Raw|Bitmap|Json) lấy từ specification. */
export type DpTypes = Record<string, string>;

/** Biên/đơn vị của 1 DP Integer (parse từ `values` chuỗi JSON trong specification). */
export type DpValueSpec = {
  min?: number;
  max?: number;
  scale?: number;
  step?: number;
  unit?: string;
  range?: string[];
};

/**
 * Code ứng viên cho từng chức năng (chuẩn Tuya + custom của bồn g0cv1c). Cái nào thiết bị có trước
 * thì lấy; code custom (setting_*) xếp cuối để code chuẩn (máy khác) được ưu tiên.
 */
const CODE_CANDIDATES: Record<DpFn, string[]> = {
  currentTemp: ['temp_current', 'cur_temp', 'water_temp', 'temp', 'sensor_1'],
  currentTempF: ['temp_current_f', 'sensor_f_1'],
  targetTemp: ['temp_set', 'settemp', 'target_temp', 'setting_temp'],
  tempRange: ['setting_temp_range', 'temp_range'],
  power: ['switch', 'switch_1', 'power', 'setting_pwr'],
  light: ['switch_led', 'light', 'led_switch', 'setting_4'],
  purify: [
    'switch_purify',
    'purify',
    'ozone',
    'uv',
    'switch_filter',
    'filter',
    'setting_clr',
  ],
  fault: ['fault'],
};

// ───────────────────────── Specification ─────────────────────────

export type DeviceSpec = {
  map: DpMap; //          function → code
  types: DpTypes; //      code → kiểu
  values: Record<string, DpValueSpec>; // code → biên (Integer)
};

type SpecEntry = { code?: string; type?: string; values?: unknown };
type SpecResult = { functions?: SpecEntry[]; status?: SpecEntry[] };

function parseValues(values: unknown): DpValueSpec {
  // `values` trong specification là CHUỖI JSON (vd '{"min":-450,"max":999,"scale":1,"unit":"℃"}').
  if (values == null) return {};
  let obj: unknown = values;
  if (typeof values === 'string') {
    try {
      obj = JSON.parse(values || '{}');
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object') return {};
  const o = obj as Record<string, unknown>;
  const numOf = (v: unknown): number | undefined =>
    typeof v === 'number'
      ? v
      : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))
        ? Number(v)
        : undefined;
  return {
    min: numOf(o.min),
    max: numOf(o.max),
    scale: numOf(o.scale),
    step: numOf(o.step),
    unit: typeof o.unit === 'string' ? o.unit : undefined,
    range: Array.isArray(o.range)
      ? (o.range as unknown[]).map(String)
      : undefined,
  };
}

/** Gộp functions[]+status[] của specification → map code + kiểu + biên. */
export function parseSpecification(
  result: SpecResult | null | undefined,
): DeviceSpec {
  const types: DpTypes = {};
  const values: Record<string, DpValueSpec> = {};
  const codes = new Set<string>();
  for (const e of [...(result?.functions ?? []), ...(result?.status ?? [])]) {
    if (!e || !e.code) continue;
    codes.add(e.code);
    if (typeof e.type === 'string') types[e.code] = e.type;
    values[e.code] = parseValues(e.values);
  }
  const map: DpMap = {};
  for (const fn of Object.keys(CODE_CANDIDATES) as DpFn[]) {
    for (const code of CODE_CANDIDATES[fn]) {
      if (codes.has(code)) {
        map[fn] = code;
        break;
      }
    }
  }
  return { map, types, values };
}

/**
 * Khi KHÔNG có specification (vd list chỉ trả status), vẫn resolve map từ các code có trong status.
 * Không biết kiểu ⇒ types rỗng (decode/build phải suy đoán an toàn).
 */
export function resolveMapFromCodes(codes: string[]): DpMap {
  const set = new Set(codes);
  const map: DpMap = {};
  for (const fn of Object.keys(CODE_CANDIDATES) as DpFn[]) {
    for (const code of CODE_CANDIDATES[fn]) {
      if (set.has(code)) {
        map[fn] = code;
        break;
      }
    }
  }
  return map;
}

// ───────────────────────── Raw DP (mảng int16 big-endian, BASE64) ─────────────────────────
//
// Layout XEN KẼ theo sensor (°C rồi °F), theo mô tả DP của model g0cv1c:
// setting_temp (DP115): 8 word = [°C, °F] × 4 sensor; word0 = setpoint °C sensor1.
// setting_temp_range (DP114): 16 word = [°C trên, °C dưới, °F trên, °F dưới] × 4 sensor;
//   word0/word1 = (trên,dưới) °C sensor1.
// Qua Cloud value là BASE64; nhưng STATUS có thể trả base64 HOẶC hex (chưa xác minh - Q1). Nên
// `rawToWords` thử base64 rồi fallback hex.

const UNSET_WORD = 0xffff;
const TARGET_TEMP_WORD = 0;
const MAX_SENSORS = 4;
const RANGE_WORDS_PER_SENSOR = 4; // DP114: [°C trên, °C dưới, °F trên, °F dưới]

const toSigned = (w: number): number => (w >= 0x8000 ? w - 0x10000 : w);

function bytesToWords(bytes: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2)
    out.push((bytes[i] << 8) | bytes[i + 1]);
  return out;
}

function base64ToBytes(s: string): number[] | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length % 4 !== 0) return null;
  try {
    return Array.from(Buffer.from(s, 'base64'));
  } catch {
    return null;
  }
}

function hexToBytes(s: string): number[] | null {
  if (s.length === 0 || s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s))
    return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 2)
    out.push(parseInt(s.slice(i, i + 2), 16));
  return out;
}

/** Chuỗi raw (base64 hoặc hex) → mảng word 16-bit. `encoding` ép 1 kiểu; mặc định thử base64 rồi hex. */
export function rawToWords(raw: string, encoding?: 'base64' | 'hex'): number[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  if (encoding === 'hex') return bytesToWords(hexToBytes(s) ?? []);
  if (encoding === 'base64') return bytesToWords(base64ToBytes(s) ?? []);
  // Auto: base64 là chuẩn cloud → ưu tiên; hex chỉ nhận khi base64 fail và chuỗi là hex hợp lệ.
  const b = base64ToBytes(s);
  if (b) return bytesToWords(b);
  const h = hexToBytes(s);
  return h ? bytesToWords(h) : [];
}

export function wordsToBase64(words: number[]): string {
  const bytes: number[] = [];
  for (const w of words) {
    bytes.push((w >> 8) & 0xff, w & 0xff);
  }
  return Buffer.from(bytes).toString('base64');
}

/** Đọc setpoint (word0) từ chuỗi raw. Word trống (ffff)/parse hỏng ⇒ null. */
export function readTargetWord(
  raw: string,
  encoding?: 'base64' | 'hex',
): number | null {
  const w = rawToWords(raw, encoding);
  if (TARGET_TEMP_WORD >= w.length || w[TARGET_TEMP_WORD] === UNSET_WORD)
    return null;
  return toSigned(w[TARGET_TEMP_WORD]);
}

/**
 * Ghi setpoint vào word0, GIỮ NGUYÊN mọi word khác → trả BASE64 (để gửi command).
 * Cần chuỗi raw hiện tại (đọc từ status). Parse hỏng/rỗng ⇒ null (caller KHÔNG được gửi).
 */
export function writeTargetWord(
  currentRaw: string,
  targetRaw: number,
  encoding?: 'base64' | 'hex',
): string | null {
  const w = rawToWords(currentRaw, encoding);
  if (w.length === 0) return null;
  w[TARGET_TEMP_WORD] = Math.round(targetRaw) & 0xffff;
  return wordsToBase64(w);
}

/**
 * DP raw setting_temp_range → biên °C (RAW) của sensor đầu tiên đang dùng.
 * Chỉ đọc cặp °C (2 word đầu của mỗi sensor), không bao giờ lấy cặp °F.
 */
export function readTempRange(
  raw: string,
  encoding?: 'base64' | 'hex',
): { min: number; max: number } | null {
  const w = rawToWords(raw, encoding);
  for (let s = 0; s < MAX_SENSORS; s++) {
    const i = s * RANGE_WORDS_PER_SENSOR;
    if (i + 1 >= w.length) break;
    if (w[i] === UNSET_WORD || w[i + 1] === UNSET_WORD) continue;
    const a = toSigned(w[i]);
    const b = toSigned(w[i + 1]);
    if (a === b) continue;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return null;
}

// ───────────────────────── Decode status → model ─────────────────────────

export type DeviceModel = {
  online?: boolean;
  currentTemp: number | null; // ĐÃ chia scale (hiển thị), vd 6.4
  targetTemp: number | null; //  ĐÃ chia scale, vd 4.0
  // Biên target ở ĐƠN VỊ HIỂN THỊ (vd 2.0–15.0, step 0.5) - dùng cho nút ± của admin.
  tempRange: { min: number; max: number; step: number; unit: string } | null;
  power: boolean | null;
  light: boolean | null;
  purify: boolean | null;
  fault: number | null;
  raw: Record<string, unknown>; // toàn bộ {code: value} để hiển thị/chẩn đoán
};

type StatusItem = { code?: string; value?: unknown };

const asBool = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;
const asNum = (v: unknown): number | null =>
  typeof v === 'number'
    ? v
    : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))
      ? Number(v)
      : null;

const divScale = (raw: number | null, scale: number): number | null =>
  raw == null ? null : raw / Math.pow(10, scale);

/** '℃'/'C' → '°C' cho đồng nhất. */
function normalizeUnit(u: string): string {
  const t = u.trim();
  if (t === '℃' || t === 'C' || t === '°C') return '°C';
  if (t === '℉' || t === 'F' || t === '°F') return '°F';
  return t || '°C';
}

/**
 * Status list `[{code,value}]` + spec → model điều khiển.
 * @param rawEncoding ép kiểu raw-trong-status khi đã biết (Q1); mặc định auto (base64→hex).
 */
export function decodeStatus(
  status: StatusItem[] | null | undefined,
  spec: DeviceSpec,
  rawEncoding?: 'base64' | 'hex',
): DeviceModel {
  const byCode: Record<string, unknown> = {};
  for (const s of status ?? []) if (s && s.code) byCode[s.code] = s.value;

  const { map, values } = spec;
  const get = (fn: DpFn): unknown => {
    const code = map[fn];
    return code ? byCode[code] : undefined;
  };

  const curScale = (map.currentTemp && values[map.currentTemp]?.scale) || 0;
  const curUnit = normalizeUnit(
    (map.currentTemp && values[map.currentTemp]?.unit) || '°C',
  );

  // Target: DP raw (đọc word0) hoặc Integer thường.
  let targetRaw: number | null = null;
  const targetVal = get('targetTemp');
  const targetType = map.targetTemp ? spec.types[map.targetTemp] : undefined;
  if (
    typeof targetVal === 'string' &&
    (targetType === 'Raw' || targetType == null)
  ) {
    targetRaw = readTargetWord(targetVal, rawEncoding);
  } else {
    targetRaw = asNum(targetVal);
  }

  // tempRange: từ DP raw setting_temp_range; mượn scale/unit của cảm biến; trả ở ĐƠN VỊ HIỂN THỊ.
  let tempRange: DeviceModel['tempRange'] = null;
  const rangeVal = get('tempRange');
  if (typeof rangeVal === 'string') {
    const pair = readTempRange(rangeVal, rawEncoding);
    if (pair) {
      const f = Math.pow(10, curScale);
      tempRange = {
        min: pair.min / f,
        max: pair.max / f,
        step: curScale >= 1 ? 0.5 : 1, // DP raw không khai step; giả định 0.5°C (xem note mapping)
        unit: curUnit,
      };
    }
  }

  return {
    online: undefined,
    currentTemp: divScale(asNum(get('currentTemp')), curScale),
    targetTemp: divScale(targetRaw, curScale),
    tempRange,
    power: asBool(get('power')),
    light: asBool(get('light')),
    purify: asBool(get('purify')),
    fault: asNum(get('fault')),
    raw: byCode,
  };
}

// ───────────────────────── Build commands ─────────────────────────

export type ControlInput = {
  target?: number; // nhiệt độ HIỂN THỊ (vd 7.5) - sẽ nhân scale khi build
  power?: boolean;
  light?: boolean;
  purify?: boolean;
};

export type Command = { code: string; value: unknown };

export class MissingDpError extends Error {
  constructor(public readonly fn: DpFn) {
    super(`Thiết bị không có DP điều khiển "${fn}".`);
    this.name = 'MissingDpError';
  }
}

/**
 * Dựng mảng command cho Cloud từ ý muốn điều khiển.
 * - bool (power/light/purify): value bool thẳng.
 * - target: Integer → số nguyên raw (×scale); Raw → base64 ghi word0 (cần `currentTargetRaw` = chuỗi
 *   raw hiện tại đọc từ status). Thiếu DP hoặc thiếu raw hiện tại ⇒ ném lỗi (KHÔNG gửi bừa).
 * @param currentTargetRaw chuỗi raw hiện tại của setting_temp (bắt buộc khi target là Raw)
 */
export function buildCommands(
  input: ControlInput,
  spec: DeviceSpec,
  currentTargetRaw?: string,
  rawEncoding?: 'base64' | 'hex',
): Command[] {
  const { map, types, values } = spec;
  const cmds: Command[] = [];

  const bools: [DpFn, boolean | undefined][] = [
    ['power', input.power],
    ['light', input.light],
    ['purify', input.purify],
  ];
  for (const [fn, val] of bools) {
    if (val === undefined) continue;
    const code = map[fn];
    if (!code) throw new MissingDpError(fn);
    cmds.push({ code, value: val });
  }

  if (input.target !== undefined) {
    const code = map.targetTemp;
    if (!code) throw new MissingDpError('targetTemp');
    const scale =
      values[code]?.scale ??
      (map.currentTemp ? values[map.currentTemp]?.scale : 0) ??
      0;
    const raw = Math.round(input.target * Math.pow(10, scale));
    const type = types[code];
    if (type === 'Raw' || (type == null && currentTargetRaw != null)) {
      if (currentTargetRaw == null) throw new MissingDpError('targetTemp');
      const b64 = writeTargetWord(currentTargetRaw, raw, rawEncoding);
      if (b64 == null) throw new MissingDpError('targetTemp');
      cmds.push({ code, value: b64 });
    } else {
      cmds.push({ code, value: raw });
    }
  }

  return cmds;
}
