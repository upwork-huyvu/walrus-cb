// Parse `schemaJson` (từ getDeviceSnapshot) → ràng buộc cho DP nhiệt độ mục tiêu (min/max/step/scale/unit),
// để render nút +/- đúng biên thay vì hardcode. ⚠️ DP id (`DP.targetTemp`) vẫn placeholder tới khi có schema
// bồn thật; parser viết kiểu schema-driven nên tự thích nghi khi cắm số liệu thật.
//
// Tuya value-DP: giá trị raw là SỐ NGUYÊN; giá trị hiển thị = raw / 10^scale. min/max/step trong schema CŨNG raw.
// → Ta giữ MỌI THỨ ở đơn vị RAW trong state (dp value, clamp, publish đều raw cho nhất quán) và chỉ chia scale
// lúc HIỂN THỊ (formatTemp). Ví dụ schema {min:-100,max:600,step:5,scale:1} ⇒ raw -100..600 bước 5 = -10.0..60.0°C.
import { DP } from './dp';

export type TempRange = {
  min: number; // RAW (chia 10^scale khi hiển thị)
  max: number; // RAW
  step: number; // RAW, > 0
  scale: number; // số chữ số thập phân; display = raw / 10^scale
  unit: string;
};

// Dùng khi thiếu schema (dev/mock/chưa có số liệu thật). Giữ biên cũ của UI clone.
export const DEFAULT_TEMP_RANGE: TempRange = {
  min: -3,
  max: 12,
  step: 1,
  scale: 0,
  unit: '°C',
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

// '℃'/'C' → '°C' cho đồng nhất; còn lại giữ nguyên.
function normalizeUnit(unit: string): string {
  const u = unit.trim();
  if (u === '℃' || u === 'C' || u === '°C') return '°C';
  if (u === '℉' || u === 'F' || u === '°F') return '°F';
  return u;
}

// Entry schema khớp DP nhiệt độ mục tiêu (so theo id/dpId).
function matchesTarget(e: Record<string, unknown>): boolean {
  return String(e.id) === DP.targetTemp || String(e.dpId) === DP.targetTemp;
}

// Schema Tuya có thể là mảng [{id, property:{...}}] hoặc object {"<dpId>": {...}}.
function findTargetEntry(parsed: unknown): Record<string, unknown> | null {
  if (Array.isArray(parsed)) {
    const hit = parsed.find(
      (e) => e && typeof e === 'object' && matchesTarget(e as Record<string, unknown>),
    );
    return (hit as Record<string, unknown>) ?? null;
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const direct = obj[DP.targetTemp];
    if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object' && matchesTarget(v as Record<string, unknown>)) {
        return v as Record<string, unknown>;
      }
    }
  }
  return null;
}

/** Parse schemaJson → TempRange của DP target temp. Thiếu/sai schema → DEFAULT_TEMP_RANGE. */
export function parseTempRange(schemaJson: string): TempRange {
  try {
    const entry = findTargetEntry(JSON.parse(schemaJson || ''));
    if (!entry) return DEFAULT_TEMP_RANGE;
    // ràng buộc có thể ở entry.property hoặc trực tiếp trên entry.
    const prop = (entry.property && typeof entry.property === 'object'
      ? (entry.property as Record<string, unknown>)
      : entry) as Record<string, unknown>;

    const min = num(prop.min);
    const max = num(prop.max);
    if (min == null || max == null) return DEFAULT_TEMP_RANGE;

    const scale = num(prop.scale) ?? 0;
    const rawStep = num(prop.step);
    const unit =
      typeof prop.unit === 'string' && prop.unit.trim()
        ? normalizeUnit(prop.unit)
        : DEFAULT_TEMP_RANGE.unit;

    // Giữ RAW (không chia scale) để clamp/publish nhất quán với dp value; scale chỉ dùng khi hiển thị.
    return {
      min,
      max,
      step: rawStep == null || rawStep <= 0 ? DEFAULT_TEMP_RANGE.step : rawStep,
      scale,
      unit,
    };
  } catch {
    return DEFAULT_TEMP_RANGE;
  }
}

/** Kẹp nhiệt độ (RAW) vào [min, max] của range (không snap theo step — +/- đã dùng step). */
export function clampToRange(temp: number, range: TempRange): number {
  if (temp < range.min) return range.min;
  if (temp > range.max) return range.max;
  return temp;
}

/** Định dạng nhiệt độ RAW → chuỗi hiển thị (chia 10^scale, đúng số thập phân) + đơn vị. null → '—'. */
export function formatTemp(raw: number | null, range: TempRange): string {
  if (raw == null) return '—';
  const v = raw / Math.pow(10, range.scale);
  return `${v.toFixed(range.scale > 0 ? range.scale : 0)}${range.unit}`;
}
