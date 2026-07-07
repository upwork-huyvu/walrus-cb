let mockMem: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockMem[k] ?? null),
  setItem: (k: string, v: string) => {
    mockMem[k] = v;
    return Promise.resolve();
  },
}));

import {
  loadRitual,
  saveRitual,
  summarizeDay,
  last7Days,
  toISODate,
  totalMinutesOf,
  type RitualData,
  type SessionRecord,
} from './ritualStore';

beforeEach(() => {
  mockMem = {};
});

const rec = (date: string, seconds: number, points = 0): SessionRecord => ({
  date,
  seconds,
  points,
  ts: 0,
});

describe('tổng hợp (thuần)', () => {
  const sessions = [
    rec('2026-07-06', 120, 100),
    rec('2026-07-06', 60, 50),
    rec('2026-07-05', 180, 90),
  ];

  it('summarizeDay: gộp đúng ngày', () => {
    expect(summarizeDay(sessions, '2026-07-06')).toEqual({
      date: '2026-07-06',
      sessions: 2,
      seconds: 180,
      points: 150,
    });
    expect(summarizeDay(sessions, '2026-07-04')).toEqual({
      date: '2026-07-04',
      sessions: 0,
      seconds: 0,
      points: 0,
    });
  });

  it('last7Days: 7 mục, cũ→mới, hôm nay ở cuối', () => {
    const w = last7Days(sessions, '2026-07-06');
    expect(w).toHaveLength(7);
    expect(w[6].date).toBe('2026-07-06');
    expect(w[0].date).toBe('2026-06-30');
    expect(w[6].sessions).toBe(2);
    expect(w[5].sessions).toBe(1);
  });

  it('toISODate: YYYY-MM-DD local', () => {
    expect(toISODate(new Date(2026, 6, 6))).toBe('2026-07-06'); // month 6 = July
  });

  it('totalMinutesOf: tổng giây / 60 làm tròn', () => {
    const d: RitualData = {
      sessions,
      ritualPoints: 0,
      streak: 0,
      lastDate: null,
    };
    expect(totalMinutesOf(d)).toBe(6); // 360s = 6 phút
  });
});

describe('persist (AsyncStorage mock)', () => {
  it('load khi rỗng → EMPTY', async () => {
    const d = await loadRitual();
    expect(d.sessions).toEqual([]);
    expect(d.ritualPoints).toBe(0);
  });

  it('save rồi load → round-trip đúng', async () => {
    const data: RitualData = {
      sessions: [rec('2026-07-06', 120, 100)],
      ritualPoints: 100,
      streak: 3,
      lastDate: '2026-07-06',
    };
    await saveRitual(data);
    expect(await loadRitual()).toEqual(data);
  });

  it('JSON hỏng → EMPTY (không throw)', async () => {
    mockMem['walrus.ritual.v1'] = '{bad json';
    await expect(loadRitual()).resolves.toEqual(
      expect.objectContaining({ sessions: [], ritualPoints: 0 }),
    );
  });
});
