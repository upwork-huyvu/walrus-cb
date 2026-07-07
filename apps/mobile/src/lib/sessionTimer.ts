// Logic thuần cho đồng hồ session (test được). 'timed' = đếm ngược từ target; 'open' = đếm lên.
export type TimerMode = 'timed' | 'open';

/** Thanh trượt thời lượng (phút): kéo 1..10, mặc định 3. */
export const DURATION_MIN = 1; // phút
export const DURATION_MAX = 10; // phút
export const DURATION_DEFAULT = 3; // phút (mặc định khi mở màn)

/**
 * Quy đổi fraction (0..1) trên thanh trượt → số phút NGUYÊN, kẹp [min,max].
 * Dùng cho DurationSlider (map vị trí chạm → phút). Test được, tách khỏi UI.
 */
export function minutesFromFraction(frac: number, min = DURATION_MIN, max = DURATION_MAX): number {
  const f = Math.min(1, Math.max(0, frac));
  return Math.min(max, Math.max(min, Math.round(min + f * (max - min))));
}

/** Fraction (0..1) của một giá trị phút trên thanh trượt [min,max] - để vẽ vị trí thumb. */
export function fractionOfMinutes(minutes: number, min = DURATION_MIN, max = DURATION_MAX): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (minutes - min) / (max - min)));
}

const OPEN_MAX = 180; // mốc "đầy" vòng WaterCircle cho chế độ open

/** Số giây hiển thị trên đồng hồ: timed → còn lại (đếm ngược); open → đã trôi. */
export function displaySeconds(mode: TimerMode, target: number, elapsed: number): number {
  return mode === 'timed' ? Math.max(0, target - elapsed) : elapsed;
}

/** Timed đã hết giờ? (elapsed chạm/vượt target) */
export function isTimedDone(mode: TimerMode, target: number, elapsed: number): boolean {
  return mode === 'timed' && elapsed >= target;
}

/** Tiến trình vòng (0..1): timed theo target, open theo OPEN_MAX. */
export function progressFraction(mode: TimerMode, target: number, elapsed: number): number {
  const denom = mode === 'timed' ? target : OPEN_MAX;
  return denom > 0 ? Math.min(1, elapsed / denom) : 0;
}

/** maxSeconds truyền cho WaterCircle theo mode. */
export function circleMax(mode: TimerMode, target: number): number {
  return mode === 'timed' ? target : OPEN_MAX;
}
