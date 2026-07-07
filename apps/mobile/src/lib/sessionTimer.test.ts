import {
  circleMax,
  displaySeconds,
  fractionOfMinutes,
  isTimedDone,
  minutesFromFraction,
  progressFraction,
  DURATION_MIN,
  DURATION_MAX,
} from './sessionTimer';

describe('sessionTimer (đếm ngược / đếm lên)', () => {
  it('displaySeconds: timed đếm ngược, open đếm lên', () => {
    expect(displaySeconds('timed', 120, 0)).toBe(120);
    expect(displaySeconds('timed', 120, 30)).toBe(90);
    expect(displaySeconds('timed', 120, 200)).toBe(0); // không âm
    expect(displaySeconds('open', 120, 45)).toBe(45);
  });

  it('isTimedDone: chỉ true khi timed + elapsed >= target', () => {
    expect(isTimedDone('timed', 120, 119)).toBe(false);
    expect(isTimedDone('timed', 120, 120)).toBe(true);
    expect(isTimedDone('timed', 120, 121)).toBe(true);
    expect(isTimedDone('open', 120, 999)).toBe(false); // open không tự hết
  });

  it('progressFraction: 0..1 theo mode', () => {
    expect(progressFraction('timed', 120, 60)).toBe(0.5);
    expect(progressFraction('timed', 120, 999)).toBe(1); // kẹp
    expect(progressFraction('open', 180, 90)).toBe(0.5);
  });

  it('circleMax: timed=target, open=180', () => {
    expect(circleMax('timed', 300)).toBe(300);
    expect(circleMax('open', 300)).toBe(180);
  });

  it('minutesFromFraction: map 0..1 → phút nguyên, kẹp [1,10]', () => {
    expect(minutesFromFraction(0)).toBe(DURATION_MIN); // 1
    expect(minutesFromFraction(1)).toBe(DURATION_MAX); // 10
    expect(minutesFromFraction(-5)).toBe(DURATION_MIN); // kẹp dưới
    expect(minutesFromFraction(9)).toBe(DURATION_MAX); // kẹp trên
    expect(minutesFromFraction(2 / 9)).toBe(3); // 1 + 2 = 3 phút
    expect(Number.isInteger(minutesFromFraction(0.37))).toBe(true); // luôn nguyên
  });

  it('fractionOfMinutes: nghịch đảo (đặt thumb), kẹp 0..1', () => {
    expect(fractionOfMinutes(1)).toBe(0);
    expect(fractionOfMinutes(10)).toBe(1);
    expect(fractionOfMinutes(3)).toBeCloseTo(2 / 9, 5);
    expect(fractionOfMinutes(0)).toBe(0); // kẹp
    expect(fractionOfMinutes(99)).toBe(1); // kẹp
  });
});
