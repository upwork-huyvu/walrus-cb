// Lưu trữ ritual (LOCAL - AsyncStorage). Trước đây state ritual chỉ in-memory → mất khi restart;
// giờ persist + log per-session theo ngày để làm daily summary. Pattern try/catch no-op như deviceStore.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'walrus.ritual.v1';

/** 1 phiên tắm lạnh đã hoàn thành. date = YYYY-MM-DD (giờ local). */
export type SessionRecord = { date: string; seconds: number; points: number; ts: number };

export type RitualData = {
  sessions: SessionRecord[];
  ritualPoints: number;
  streak: number;
  lastDate: string | null; // YYYY-MM-DD phiên gần nhất (cho streak)
};

export const EMPTY_RITUAL: RitualData = {
  sessions: [],
  ritualPoints: 0,
  streak: 0,
  lastDate: null,
};

/** YYYY-MM-DD theo giờ LOCAL (không dùng toISOString vì lệch UTC). */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function loadRitual(): Promise<RitualData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_RITUAL };
    const d = JSON.parse(raw) as Partial<RitualData>;
    return {
      ...EMPTY_RITUAL,
      ...d,
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
    };
  } catch {
    return { ...EMPTY_RITUAL };
  }
}

export async function saveRitual(data: RitualData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* no-op */
  }
}

// ---------- Tổng hợp (thuần - test được) ----------
export type DaySummary = { date: string; sessions: number; seconds: number; points: number };

/** Tổng hợp 1 ngày từ log. */
export function summarizeDay(sessions: SessionRecord[], dayISO: string): DaySummary {
  let s = 0;
  let sec = 0;
  let p = 0;
  for (const rec of sessions) {
    if (rec.date === dayISO) {
      s += 1;
      sec += rec.seconds;
      p += rec.points;
    }
  }
  return { date: dayISO, sessions: s, seconds: sec, points: p };
}

/** 7 ngày gần nhất (cũ→mới), tính tới todayISO. */
export function last7Days(sessions: SessionRecord[], todayISO: string): DaySummary[] {
  const today = new Date(`${todayISO}T00:00:00`);
  const out: DaySummary[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(summarizeDay(sessions, toISODate(d)));
  }
  return out;
}

export const totalSessionsOf = (d: RitualData): number => d.sessions.length;
export const totalMinutesOf = (d: RitualData): number =>
  Math.round(d.sessions.reduce((sum, s) => sum + s.seconds, 0) / 60);
