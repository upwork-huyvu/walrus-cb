// Map chức năng bồn tắm đá ↔ DP id của thiết bị THẬT.
//
// NGUYÊN TẮC (đổi sau sự cố 2026-07-24): **KHÔNG đoán DP id.**
// Bản cũ có bảng placeholder cứng (`currentTemp:'105'`, `light:'101'`…) dùng làm fallback khi
// không resolve được code. Trên bồn thật, placeholder **trùng ngẫu nhiên** với DP khác nghĩa:
//   105 = sensor_f_1 (độ F)  → app hiện 43.0 khi nước 6.4°C
//   101 = sensor_1  (độ C)   → giá trị 64 truthy ⇒ "đèn luôn bật"
// Lỗi im lặng kiểu này nguy hiểm hơn crash. Nay: **resolve được thì dùng, không thì để trống**
// và tầng trên từ chối publish thay vì ghi bừa vào DP lạ.
// Chi tiết: docs/research/tuya-icebath-dp-mapping.md
import { dpTypeById } from './tuyaSchema';

/**
 * `dpCodesJson` → `{ code(lowercase): dpId }`.
 * Chịu được cả 3 dạng native/SDK có thể trả: `{"104":"temp_set"}` (id→code),
 * `{"temp_set":"104"}` (code→id), và `[{dpId|id, code}]`.
 */
export function parseDpCodes(dpCodesJson: string): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (code: unknown, id: unknown) => {
    const c = String(code ?? '').trim().toLowerCase();
    const i = String(id ?? '').trim();
    if (c && i && c !== 'undefined' && i !== 'undefined') out[c] = i;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(dpCodesJson || '');
  } catch {
    return out;
  }

  if (Array.isArray(parsed)) {
    for (const e of parsed) {
      if (e && typeof e === 'object') {
        const o = e as Record<string, unknown>;
        put(o.code, o.dpId ?? o.id);
      }
    }
    return out;
  }
  if (parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      // key là số ⇒ đó là dpId, value là code. Ngược lại key là code, value là dpId.
      if (/^\d+$/.test(k)) put(v, k);
      else put(k, v);
    }
  }
  return out;
}

/** Các chức năng app quan tâm. DP nào thiết bị không có ⇒ key vắng trong `DpMap`. */
export type DpFn =
  | 'currentTemp'
  | 'currentTempF'
  | 'targetTemp'
  | 'tempRange'
  | 'power'
  | 'fault'
  | 'unit'
  | 'light'
  | 'purify'
  | 'freeze';

/** function → dpId. Thiếu key = thiết bị KHÔNG có chức năng đó (đừng publish). */
export type DpMap = Partial<Record<DpFn, string>>;

/**
 * Code ứng viên cho từng chức năng, xét theo thứ tự.
 * Gồm cả code chuẩn Tuya lẫn code custom gặp trên thiết bị thật (`sensor_1`, `setting_temp`…).
 * Tuya giữ dpId 1–100 cho bộ chuẩn, custom bắt đầu từ 101 ⇒ code custom không có spec công khai,
 * chỉ thêm vào đây khi đã XÁC MINH trên máy thật.
 */
const CODE_CANDIDATES: Record<DpFn, string[]> = {
  currentTemp: ['temp_current', 'cur_temp', 'water_temp', 'temp', 'sensor_1'],
  // ⚠️ Tách riêng bản độ F - KHÔNG được rơi vào currentTemp (chính là bug cũ).
  currentTempF: ['temp_current_f', 'sensor_f_1'],
  targetTemp: ['temp_set', 'settemp', 'target_temp', 'setting_temp'],
  tempRange: ['setting_temp_range', 'temp_range'],
  power: ['switch', 'switch_1', 'power', 'setting_pwr'],
  fault: ['fault'],
  unit: ['temp_unit_convert', 'setting_unit'],
  // `setting_4` = "Lighting" và `setting_clr` = "Disinfection" theo bảng thuộc tính Tuya của model
  // g0cv1c (bồn đang dùng). Tên code vô nghĩa nên CHỈ đúng cho model này - xếp CUỐI danh sách để
  // code chuẩn (nếu máy khác có) luôn được ưu tiên.
  light: ['switch_led', 'light', 'led_switch', 'setting_4'],
  purify: ['switch_purify', 'purify', 'ozone', 'uv', 'switch_filter', 'filter', 'setting_clr'],
  // ⚠️ Bỏ 'switch'/'switch_1' khỏi đây: trên phần lớn máy đó là CÔNG TẮC NGUỒN, không phải chế độ lạnh.
  freeze: ['refrigeration', 'chiller', 'freeze', 'cool'],
};

/** Kiểu DP lấy từ schema - quyết định cách đọc/ghi (raw thì phải encode hex). */
export type DpKinds = Partial<Record<DpFn, string>>;

/** function → kiểu DP, ghép từ `map` đã resolve với schema của thiết bị. */
export function resolveDpKinds(map: DpMap, schemaJson: string): DpKinds {
  const typeById = dpTypeById(schemaJson);
  const out: DpKinds = {};
  for (const [fn, id] of Object.entries(map)) {
    const t = id ? typeById[id] : undefined;
    if (t) out[fn as DpFn] = t;
  }
  return out;
}

/** Resolve DP id theo code thật của thiết bị. Không khớp code nào ⇒ **để trống** (không đoán). */
export function resolveDpMap(dpCodesJson: string): DpMap {
  const byCode = parseDpCodes(dpCodesJson);
  const out: DpMap = {};
  for (const fn of Object.keys(CODE_CANDIDATES) as DpFn[]) {
    for (const code of CODE_CANDIDATES[fn]) {
      const id = byCode[code];
      if (id) {
        out[fn] = id;
        break;
      }
    }
  }
  return out;
}

// ───────────────────────── DP kiểu raw (mảng int16 big-endian) ─────────────────────────
//
// Docs Tuya (iOS + Android): "A byte array of raw type is a hexadecimal string with an even
// number of digits" ⇒ đọc/ghi bằng HEX, không phải base64.
//
// Layout (theo bảng thuộc tính Tuya của model g0cv1c):
//   setting_temp_range (114): 32 byte = 16 word big-endian.
//     word 0..7  = ĐỘ C, mỗi sensor 1 cặp (trên, dưới) → sensor1 = word0/word1
//     word 8..15 = ĐỘ F, cùng bố cục
//     Bồn thật: [150,20]×4 rồi [ffff]×8 ⇒ 4 sensor đều 15.0/2.0 °C, phần °F chưa đặt.
//   setting_temp (115): 16 byte = 8 word.
//     word 0..3 = ĐỘ C cho sensor 1..4 · word 4..7 = ĐỘ F
//     Bồn thật: [40,40,ffff×6] ⇒ sensor1 = sensor2 = 4.0 °C.

/** Word chứa setpoint °C của sensor 1 trong DP `setting_temp`. */
export const TARGET_TEMP_SLOT = 0;

/** Số sensor tối đa trong khối °C của DP raw nhiệt độ (phần còn lại là °F). */
const CELSIUS_SENSORS = 4;

const UNSET_WORD = 0xffff; // slot chưa dùng (đọc kiểu có dấu = -1)

/** Hex → mảng word 16-bit KHÔNG dấu (big-endian). Hex rác / không chia hết 4 ⇒ []. */
function hexWords(hex: string): number[] {
  const s = String(hex ?? '').trim();
  if (s.length === 0 || s.length % 4 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return [];
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) out.push(parseInt(s.slice(i, i + 4), 16));
  return out;
}

const wordsToHex = (w: number[]): string =>
  w.map((x) => (x & 0xffff).toString(16).padStart(4, '0')).join('');

// Nhiệt độ có thể ÂM (cảm biến tới -45.0°C) ⇒ int16 bù 2.
const toSigned = (w: number): number => (w >= 0x8000 ? w - 0x10000 : w);

/** Đọc 1 slot của DP raw → giá trị RAW (chưa chia scale). Slot trống/hex hỏng ⇒ null. */
export function readRawSlot(hex: string, slot: number = TARGET_TEMP_SLOT): number | null {
  const w = hexWords(hex);
  if (slot < 0 || slot >= w.length || w[slot] === UNSET_WORD) return null;
  return toSigned(w[slot]);
}

/**
 * Ghi 1 slot, **GIỮ NGUYÊN mọi slot khác** (kể cả sentinel ffff).
 * Ghi thiếu byte có thể làm firmware hiểu sai cả mảng ⇒ luôn encode lại đủ độ dài cũ.
 * Hex nguồn hỏng / slot vượt biên ⇒ null (tầng trên phải từ chối publish).
 */
export function writeRawSlot(hex: string, slot: number, raw: number): string | null {
  const w = hexWords(hex);
  if (w.length === 0 || slot < 0 || slot >= w.length) return null;
  w[slot] = Math.round(raw) & 0xffff;
  return wordsToHex(w);
}

/**
 * DP raw `setting_temp_range` → biên °C của 1 sensor, đơn vị RAW.
 * Chỉ quét khối °C (word 0..2N-1); cặp của sensor chưa đặt (`ffff`) thì thử sensor kế tiếp.
 * Tự sắp min/max nên không phụ thuộc thứ tự (trên,dưới) hay (dưới,trên).
 */
export function readRawTempRange(hex: string, sensor = 0): { min: number; max: number } | null {
  const w = hexWords(hex);
  const lastCelsiusWord = Math.min(w.length, CELSIUS_SENSORS * 2);
  for (let i = Math.max(0, sensor) * 2; i + 1 < lastCelsiusWord; i += 2) {
    if (w[i] === UNSET_WORD || w[i + 1] === UNSET_WORD) continue;
    const a = toSigned(w[i]);
    const b = toSigned(w[i + 1]);
    if (a === b) continue;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return null;
}

// ───────────────────────── Cache theo thiết bị ─────────────────────────
// readDevice resolve 1 lần rồi publish/realtime dùng lại, khỏi đọc snapshot mỗi lần.

const dpMapByDev = new Map<string, DpMap>();
/** Giá trị raw (hex) mới nhất theo dpId - cần để ghi 1 slot mà không mất slot khác. */
const rawDpsByDev = new Map<string, Record<string, string>>();
/** dpId → code, để log realtime đọc được. */
const codeByIdByDev = new Map<string, Record<string, string>>();

const dpKindsByDev = new Map<string, DpKinds>();

export function setDpMap(devId: string, map: DpMap): void {
  if (devId) dpMapByDev.set(devId, map);
}
export function setDpKinds(devId: string, kinds: DpKinds): void {
  if (devId) dpKindsByDev.set(devId, kinds);
}
export function getDpKinds(devId: string): DpKinds {
  return dpKindsByDev.get(devId) ?? {};
}
/** Map của thiết bị (resolve lúc readDevice). Chưa có ⇒ **rỗng**, KHÔNG đoán placeholder. */
export function getDpMap(devId: string): DpMap {
  return dpMapByDev.get(devId) ?? {};
}

/** Nhớ mọi DP có value là chuỗi hex (kiểu raw/string) để lần ghi sau giữ được các slot khác. */
export function cacheRawDps(devId: string, dpsJson: string): void {
  if (!devId) return;
  const dps = parseDpsJson(dpsJson);
  const cur = rawDpsByDev.get(devId) ?? {};
  for (const [id, v] of Object.entries(dps)) if (typeof v === 'string') cur[id] = v;
  rawDpsByDev.set(devId, cur);
}
export function getRawDp(devId: string, dpId?: string): string | undefined {
  if (!devId || !dpId) return undefined;
  return rawDpsByDev.get(devId)?.[dpId];
}

export function setDpCodes(devId: string, dpCodesJson: string): void {
  if (!devId) return;
  const byCode = parseDpCodes(dpCodesJson);
  const byId: Record<string, string> = {};
  for (const [code, id] of Object.entries(byCode)) byId[id] = code;
  codeByIdByDev.set(devId, byId);
}
export function getCodeById(devId: string): Record<string, string> {
  return codeByIdByDev.get(devId) ?? {};
}

// ───────────────────────── Parse / build ─────────────────────────

export type DeviceDps = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean | null;
  purifyOn: boolean | null;
  freezeOn: boolean | null;
  powerOn: boolean | null;
  fault: number | null;
};

function parseDpsJson(dpsJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(dpsJson || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

function toBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

/** Lấy DP theo map; key vắng ⇒ undefined (không tra nhầm dps['undefined']). */
const pickDp = (dps: Record<string, unknown>, id?: string): unknown =>
  id == null ? undefined : dps[id];

/**
 * dpsJson → field thiết bị, theo `map` đã resolve.
 * `targetTemp` chịu được cả 2 dạng: DP value (số) và DP raw (hex nhiều slot).
 */
export function parseDeviceDps(dpsJson: string, map: DpMap = {}, kinds: DpKinds = {}): DeviceDps {
  const dps = parseDpsJson(dpsJson);

  // ⚠️ KHÔNG đoán raw bằng hình dạng chuỗi: payload raw có thể toàn chữ số ("00280028" sẽ bị
  // đọc nhầm thành 280028). Kiểu lấy từ schema; chỉ khi schema vắng mới suy từ việc value là chuỗi.
  const rawTarget = pickDp(dps, map.targetTemp);
  const targetIsRaw =
    kinds.targetTemp != null ? kinds.targetTemp === 'raw' : typeof rawTarget === 'string';
  const targetTemp =
    targetIsRaw && typeof rawTarget === 'string'
      ? readRawSlot(rawTarget, TARGET_TEMP_SLOT)
      : toNum(rawTarget);

  return {
    currentTemp: toNum(pickDp(dps, map.currentTemp)),
    targetTemp,
    lightOn: toBool(pickDp(dps, map.light)),
    purifyOn: toBool(pickDp(dps, map.purify)),
    freezeOn: toBool(pickDp(dps, map.freeze)),
    powerOn: toBool(pickDp(dps, map.power)),
    fault: toNum(pickDp(dps, map.fault)),
  };
}

/**
 * JSON publish cho nhiệt độ mục tiêu.
 * - `currentRawHex` có ⇒ DP kiểu raw: ghi đè đúng 1 slot, giữ nguyên phần còn lại.
 * - không có ⇒ DP value thường: gửi số.
 * @returns null khi thiếu DP / hex hỏng ⇒ **caller KHÔNG được publish**.
 */
export function buildTempDps(
  temp: number,
  map: DpMap = {},
  currentRawHex?: string,
  kinds: DpKinds = {},
): string | null {
  const id = map.targetTemp;
  if (!id) return null;
  const isRaw = kinds.targetTemp != null ? kinds.targetTemp === 'raw' : currentRawHex != null;
  if (isRaw) {
    // Chưa đọc được payload gốc thì KHÔNG ghi: gửi số vào DP raw sẽ hỏng cả mảng của firmware.
    if (!currentRawHex) return null;
    const hex = writeRawSlot(currentRawHex, TARGET_TEMP_SLOT, temp);
    return hex == null ? null : JSON.stringify({ [id]: hex });
  }
  return JSON.stringify({ [id]: temp });
}

/** JSON publish cho 1 DP bool. Thiếu DP ⇒ null (đừng ghi bừa vào DP khác). */
export function buildBoolDps(fn: DpFn, on: boolean, map: DpMap = {}): string | null {
  const id = map[fn];
  return id ? JSON.stringify({ [id]: on }) : null;
}

export const buildLightDps = (on: boolean, map: DpMap = {}): string | null =>
  buildBoolDps('light', on, map);
export const buildPurifyDps = (on: boolean, map: DpMap = {}): string | null =>
  buildBoolDps('purify', on, map);
export const buildFreezeDps = (on: boolean, map: DpMap = {}): string | null =>
  buildBoolDps('freeze', on, map);
export const buildPowerDps = (on: boolean, map: DpMap = {}): string | null =>
  buildBoolDps('power', on, map);
