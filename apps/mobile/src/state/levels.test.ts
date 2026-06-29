import {
  getLevelFromPoints,
  getLevelName,
  getStreakMultiplier,
  pointsForLevel,
} from './levels';

describe('levels', () => {
  it('getStreakMultiplier theo ngưỡng', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(2)).toBe(1.5);
    expect(getStreakMultiplier(4)).toBe(2.0);
    expect(getStreakMultiplier(7)).toBe(2.5);
    expect(getStreakMultiplier(14)).toBe(3.0);
  });

  it('getLevelFromPoints: 0 điểm = level 1', () => {
    const r = getLevelFromPoints(0);
    expect(r.level).toBe(1);
    expect(r.pointsInLevel).toBe(0);
    expect(r.pointsNeeded).toBe(pointsForLevel(1));
  });

  it('getLevelFromPoints: đủ điểm lên level 2', () => {
    const r = getLevelFromPoints(pointsForLevel(1)); // 300
    expect(r.level).toBe(2);
    expect(r.pointsInLevel).toBe(0);
  });

  it('getLevelName: có tên + fallback', () => {
    expect(getLevelName(1)).toBe('Still Dressed');
    expect(getLevelName(1000)).toBe('The Walrus');
  });
});
