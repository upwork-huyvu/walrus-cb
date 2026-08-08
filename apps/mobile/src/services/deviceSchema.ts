// Ràng buộc nhiệt độ mục tiêu (min/max/step/scale/unit) lấy từ CHÍNH thiết bị, không hardcode.
//
// Hai nguồn, theo thứ tự ưu tiên:
//   1. DP raw `setting_temp_range` (vd bồn thật: "00960014…" ⇒ 2.0–15.0 °C). DP raw KHÔNG khai báo
//      min/max/scale trong schema, nên phải decode từ payload - đây mới là biên thật.
//   2. Schema của DP target khi nó là DP `value` thường (min/max/step/scale/unit có sẵn).
// Không có cả hai ⇒ DEFAULT_TEMP_RANGE.
//
// Bản cũ dò schema theo DP id hardcode ('104') nên trên bồn thật luôn rơi về default. Xem
// docs/research/tuya-icebath-dp-mapping.md
//
// Tuya value-DP: giá trị raw là SỐ NGUYÊN; giá trị hiển thị = raw / 10^scale. min/max/step trong
// schema CŨNG raw. → Giữ MỌI THỨ ở đơn vị RAW trong state (clamp/publish đều raw cho nhất quán),
// chỉ chia scale lúc HIỂN THỊ (formatTemp).
import { readRawTempRange, type DpMap } from './dp';
import { schemaEntries, propOf, entryFor, num, normalizeUnit } from './tuyaSchema';

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

/**
 * Step khi thiết bị không khai báo (DP raw không có `step` trong schema).
 * scale ≥ 1 ⇒ 5 = 0.5 °C. ⚠️ GIẢ ĐỊNH, chưa xác minh trên máy - xem note research.
 */
const defaultStepFor = (scale: number): number => (scale >= 1 ? 5 : DEFAULT_TEMP_RANGE.step);

/**
 * Ràng buộc nhiệt độ mục tiêu của thiết bị.
 * @param map      DP đã resolve (cần `currentTemp` để biết scale/unit, `targetTemp` cho nhánh schema)
 * @param rangeHex payload DP raw `setting_temp_range` nếu thiết bị có
 */
export function parseTempRange(schemaJson: string, map: DpMap = {}, rangeHex?: string): TempRange {
  const entries = schemaEntries(schemaJson);

  // DP raw không khai báo scale/unit ⇒ mượn của DP cảm biến (cùng thang nhiệt độ, vd scale 1 + ℃).
  const sensor = propOf(entryFor(entries, map.currentTemp));
  const sensorScale = num(sensor.scale);
  const sensorUnit =
    typeof sensor.unit === 'string' && sensor.unit.trim() ? normalizeUnit(sensor.unit) : null;

  // 1) Biên THẬT từ DP raw setting_temp_range.
  const pair = rangeHex ? readRawTempRange(rangeHex) : null;
  if (pair) {
    const scale = sensorScale ?? 0;
    return {
      min: pair.min,
      max: pair.max,
      step: defaultStepFor(scale),
      scale,
      unit: sensorUnit ?? DEFAULT_TEMP_RANGE.unit,
    };
  }

  // 2) Schema của chính DP target (khi là DP `value` thường).
  const t = propOf(entryFor(entries, map.targetTemp));
  const min = num(t.min);
  const max = num(t.max);
  if (min == null || max == null) return DEFAULT_TEMP_RANGE;

  const scale = num(t.scale) ?? 0;
  const rawStep = num(t.step);
  const unit =
    typeof t.unit === 'string' && t.unit.trim() ? normalizeUnit(t.unit) : DEFAULT_TEMP_RANGE.unit;

  // Giữ RAW (không chia scale) để clamp/publish nhất quán với dp value.
  return {
    min,
    max,
    step: rawStep == null || rawStep <= 0 ? DEFAULT_TEMP_RANGE.step : rawStep,
    scale,
    unit,
  };
}

/** Kẹp nhiệt độ (RAW) vào [min, max] của range (không snap theo step - +/- đã dùng step). */
export function clampToRange(temp: number, range: TempRange): number {
  if (temp < range.min) return range.min;
  if (temp > range.max) return range.max;
  return temp;
}

/** Định dạng nhiệt độ RAW → chuỗi hiển thị (chia 10^scale, đúng số thập phân) + đơn vị. null → '-'. */
export function formatTemp(raw: number | null, range: TempRange): string {
  if (raw == null) return '-';
  const v = raw / Math.pow(10, range.scale);
  return `${v.toFixed(range.scale > 0 ? range.scale : 0)}${range.unit}`;
}
