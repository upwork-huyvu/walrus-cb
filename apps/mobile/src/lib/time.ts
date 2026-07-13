// Parse thời gian AN TOÀN TRÊN HERMES (m1-fix-notifications B5).
// ⚠️ Hermes chỉ parse tin cậy chuỗi ISO 8601. `new Date("2026-07-13 17:00:00")` (DẤU CÁCH, không 'T',
// không timezone) → Hermes trả Invalid Date → NaN. (V8/Node/jest thì parse được → bug ẩn khỏi CI.)
// parseWhen xử TƯỜNG MINH: chuỗi "YYYY-MM-DD HH:mm[:ss]" ghép bằng constructor SỐ (đáng tin mọi engine),
// chuỗi ISO có 'T'+Z/offset thì dùng Date. Không parse được → 0.

// "YYYY-MM-DD" + (dấu cách hoặc 'T') + "HH:mm" [+ ":ss"], phần đuôi (ms/timezone) bỏ qua.
const YMD_HMS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

/** Chuỗi thời gian → epoch ms. Không hợp lệ → 0. An toàn Hermes (không dựa new Date(chuỗi-dấu-cách)). */
export function parseWhen(s: string | undefined | null): number {
  if (typeof s !== 'string') return 0;
  const str = s.trim();
  if (!str) return 0;

  // ISO có 'T' và timezone rõ (Z hoặc ±HH:MM) → Hermes parse tin cậy.
  if (str.includes('T') && /(Z|[+-]\d{2}:?\d{2})$/.test(str)) {
    const t = new Date(str).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  // "YYYY-MM-DD HH:mm[:ss]" (dấu cách hoặc 'T', KHÔNG timezone) → coi LOCAL, ghép bằng constructor số.
  const m = YMD_HMS.exec(str);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const t = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      se ? Number(se) : 0,
    ).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  // Fallback: dạng ISO khác (ngày thuần, có 'T' không tz…) - thử Date, Invalid → 0.
  const t = new Date(str).getTime();
  return Number.isNaN(t) ? 0 : t;
}
