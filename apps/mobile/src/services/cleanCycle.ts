// Chu trình vệ sinh của bồn g0cv1c. Máy CHỈ có DP `setting_clr` (122, bool - nút lá), KHÔNG có DP "chu
// trình" nào ⇒ một chu trình = BẬT DP 122 rồi TẮT sau N phút.
//
// ⚠️ Lệnh tắt KHÔNG được hẹn bằng setTimeout trong app: iOS treo app vài giây sau khi ra nền và kill hẳn
// khi thiếu bộ nhớ ⇒ lệnh tắt sẽ không bao giờ chạy ⇒ ozone chạy vô hạn. Hẹn tắt phải là TIMER CLOUD của
// Tuya, chạy độc lập điện thoại. Chi tiết: dev-workflow/m1-clean-cycle/.
//
// Thao tác timer theo TASK NAME, không theo timerId: iOS chỉ xoá được theo task còn Android chỉ xoá theo
// id (mà `getTimerList` bên Android chưa wire) ⇒ task name là mẫu số chung của hai nền tảng.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMockDevId } from '../config/mock';
import { getDpMap } from './dp';
import { setPurify } from './tuya';
import { describeTuyaError } from './tuyaError';

/** Timer hẹn TẮT của chu trình chạy tay ("Run clean cycle now"). */
export const CLEAN_TASK_ONCE = 'walrus_clean_once';
/** 2 timer lặp (bật + tắt) của lịch vệ sinh. */
export const CLEAN_TASK_SCHEDULE = 'walrus_clean_sched';

/** Thời lượng cho người dùng chọn (phút). Chốt lại khi khách xác nhận chu trình thật của máy. */
export const CLEAN_DURATIONS_MIN = [15, 30, 60];
export const DEFAULT_CLEAN_MINUTES = 30;

/** Lịch vệ sinh: `days` = 0 (CN) … 6 (T7); `time` = 'HH:mm' giờ bật; `minutes` = độ dài chu trình. */
export type CleanSchedule = { days: number[]; time: string; minutes: number };

const LOOPS_ONCE = '0000000';
const MS_PER_MIN = 60_000;
/** Quá hạn bao lâu mới coi là cloud đã lỡ lệnh tắt (timer chỉ chính xác tới phút). */
const OVERDUE_GRACE_MS = 2 * MS_PER_MIN;

// ───────────────────────── Phần THUẦN (test được, không đụng native) ─────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 'HH:mm' của một mốc thời gian, theo giờ máy (cùng múi giờ với bồn - verify ở bước test thật). */
export const clockTime = (at: Date): string => `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;

/** Mốc kết thúc chu trình = now + minutes, LÀM TRÒN LÊN phút vì timer Tuya chỉ nhận 'HH:mm'. */
export function cycleEndAt(now: Date, minutes: number): Date {
  const end = new Date(now.getTime() + Math.max(1, Math.round(minutes)) * MS_PER_MIN);
  if (end.getSeconds() > 0 || end.getMilliseconds() > 0) end.setMinutes(end.getMinutes() + 1);
  end.setSeconds(0, 0);
  return end;
}

function parseClock(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

const clockOf = (totalMinutes: number): string =>
  `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;

/**
 * Cộng phút vào 'HH:mm'. `wrapped` = đã qua nửa đêm ⇒ timer tắt rơi vào NGÀY HÔM SAU, nên `loops` của nó
 * phải dịch thêm 1 ngày (xem `shiftLoops`), không thì máy tắt sớm 24 tiếng.
 */
export function addMinutesToClock(time: string, minutes: number): { time: string; wrapped: boolean } | null {
  const base = parseClock(time);
  if (base == null) return null;
  const total = base + Math.max(1, Math.round(minutes));
  return { time: clockOf(total % 1440), wrapped: total >= 1440 };
}

/** Khoảng cách phút giữa 2 mốc 'HH:mm' (qua nửa đêm vẫn đúng). */
export function minutesBetweenClocks(from: string, to: string): number | null {
  const a = parseClock(from);
  const b = parseClock(to);
  if (a == null || b == null) return null;
  return (b - a + 1440) % 1440;
}

/**
 * `days` → chuỗi `loops` 7 ký tự. **Ký tự đầu = Chủ Nhật** theo timer Tuya.
 * ⚠️ Chưa verify trên bồn thật: lịch "hằng ngày" ('1111111') thì đối xứng nên không lộ, chọn thứ cụ thể mới
 * lộ. Nếu lệch, chỉ cần sửa đúng chỗ này (+ `daysFromLoops`).
 */
export function loopsFrom(days: number[]): string {
  const on = new Set((days ?? []).map((d) => ((Math.trunc(d) % 7) + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => (on.has(i) ? '1' : '0')).join('');
}

export function daysFromLoops(loops: string): number[] {
  const s = String(loops ?? '');
  const out: number[] = [];
  for (let i = 0; i < 7; i++) if (s[i] === '1') out.push(i);
  return out;
}

/** Dịch loops sang ngày kế tiếp - dùng cho timer tắt rơi qua nửa đêm. */
export const shiftLoops = (loops: string, by = 1): string =>
  loopsFrom(daysFromLoops(loops).map((d) => (d + by) % 7));

/** Mốc chạy kế tiếp của lịch (ms) tính từ `now`. Lịch rỗng / giờ sai → null. */
export function nextScheduleRun(schedule: CleanSchedule | null, now: Date): number | null {
  const t = schedule ? parseClock(schedule.time) : null;
  if (!schedule || t == null || schedule.days.length === 0) return null;
  for (let i = 0; i < 8; i++) {
    const at = new Date(now);
    at.setDate(at.getDate() + i);
    at.setHours(Math.floor(t / 60), t % 60, 0, 0);
    if (at.getTime() > now.getTime() && schedule.days.includes(at.getDay())) return at.getTime();
  }
  return null;
}

/**
 * Đọc giá trị bool của 1 DP trong `dpsJson` của timer.
 * Hai nền tảng trả KHÁC nhau: iOS lấy nguyên `dps` từ cloud (có thể là `true`, `"true"`, hoặc `1`), Android
 * dựng lại từ `dpId`+`value` (chuỗi) ⇒ phải chịu cả ba kiểu, không thì lịch có mà app báo "chưa đặt".
 */
export function dpBoolOf(dpsJson: string, dpId?: string): boolean | null {
  let dps: Record<string, unknown>;
  try {
    const parsed = JSON.parse(dpsJson || '{}');
    if (!parsed || typeof parsed !== 'object') return null;
    dps = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const v = dpId && dpId in dps ? dps[dpId] : Object.values(dps)[0];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    if (/^true$/i.test(v.trim())) return true;
    if (/^false$/i.test(v.trim())) return false;
    if (/^\d+$/.test(v.trim())) return Number(v) !== 0;
  }
  return null;
}

/** Mốc xảy ra kế tiếp của 'HH:mm' tính từ `now` (hôm nay nếu còn kịp, không thì ngày mai). */
export function nextOccurrence(time: string, now: Date): number | null {
  const t = parseClock(time);
  if (t == null) return null;
  const at = new Date(now);
  at.setHours(Math.floor(t / 60), t % 60, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at.getTime();
}

// ───────────────────────── Native + bộ nhớ ─────────────────────────

let lib: any = null;
try {
  lib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  lib = null;
}

/** Module timer khi native có mặt VÀ thiết bị là bồn thật; ngược lại → null (nhánh mock). */
function timerApi(devId: string): any | null {
  if (!devId || isMockDevId(devId)) return null;
  const t = lib?.Tuya;
  return t && typeof t.addTimer === 'function' ? t : null;
}

function devLog(where: string, e: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[clean] ${where} failed`, describeTuyaError(e).message, e);
  }
}

const uiError = (e: unknown, fallback: string): Error =>
  new Error(describeTuyaError(e, { fallback }).message);

/** Xoá cả task - dọn dẹp thì không được làm hỏng thao tác chính, nên nuốt lỗi (vẫn log ở dev). */
async function removeTask(api: any, devId: string, task: string): Promise<void> {
  try {
    await api.removeTimer(task, devId, 'device', []);
  } catch (e) {
    devLog(`removeTimer(${task})`, e);
  }
}

// Mốc kết thúc chu trình do CHÍNH app hẹn - cần cho lưới an toàn khi bồn offline đúng giờ tắt.
const endKey = (devId: string): string => `walrus.cleanCycleEnd.${devId}`;

async function rememberEnd(devId: string, at: number): Promise<void> {
  try {
    await AsyncStorage.setItem(endKey(devId), String(at));
  } catch {
    /* AsyncStorage chưa link (dev) → bỏ qua, state vẫn đúng trong phiên */
  }
}

async function storedEnd(devId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(endKey(devId));
    const n = Number(raw);
    return raw && !isNaN(n) ? n : null;
  } catch {
    return null;
  }
}

async function forgetEnd(devId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(endKey(devId));
  } catch {
    /* ignore */
  }
}

/** Lịch của bồn GIẢ (dev UI) - bồn thật luôn đọc/ghi trên cloud. */
const mockSchedules = new Map<string, CleanSchedule>();

const purifyDp = (devId: string): string | undefined => getDpMap(devId).purify;

function timerInput(task: string, devId: string, time: string, loops: string, dps: Record<string, boolean>, alias: string): string {
  return JSON.stringify({
    taskName: task,
    bizId: devId,
    bizType: 'device',
    time,
    loops,
    dpsJson: JSON.stringify(dps),
    status: true,
    aliasName: alias,
  });
}

// ───────────────────────── Chu trình chạy tay ─────────────────────────

/**
 * Chạy một chu trình: **hẹn TẮT trước, BẬT sau**.
 * Vì sao thứ tự đó: bật trước mà hẹn tắt lỗi (mất mạng…) thì ozone chạy mãi; ngược lại chỉ thừa một lệnh
 * tắt vô hại. Hẹn không được ⇒ KHÔNG bật, báo lỗi để người dùng biết.
 * @returns mốc kết thúc (ms) để UI hiện "Cleaning… until HH:mm".
 */
export async function startCleanCycle(
  devId: string,
  minutes = DEFAULT_CLEAN_MINUTES,
  now = new Date(),
): Promise<number> {
  const end = cycleEndAt(now, minutes);
  const api = timerApi(devId);

  if (api) {
    const dp = purifyDp(devId);
    if (!dp) throw new Error('This device has no cleaning control.');
    await removeTask(api, devId, CLEAN_TASK_ONCE); // không để hai hẹn tắt chồng nhau
    try {
      await api.addTimer(
        timerInput(CLEAN_TASK_ONCE, devId, clockTime(end), LOOPS_ONCE, { [dp]: false }, 'Walrus clean cycle'),
      );
    } catch (e) {
      throw uiError(e, 'Could not schedule the automatic stop, so the cleaning cycle was not started.');
    }
  }

  const res = await setPurify(devId, true);
  if (!res.ok) {
    if (api) await removeTask(api, devId, CLEAN_TASK_ONCE); // bật hỏng thì đừng để hẹn tắt mồ côi
    throw new Error(res.error ?? 'Could not start the cleaning cycle.');
  }
  await rememberEnd(devId, end.getTime());
  return end.getTime();
}

/**
 * Dừng chu trình: **TẮT trước, xoá hẹn sau**. Ngược lại mà lệnh tắt lỗi thì máy vẫn chạy trong khi hẹn tắt
 * đã bị xoá. Phải xoá hẹn vì timer mồ côi sẽ tắt nhầm lần người dùng tự bật nút lá sau đó.
 */
export async function stopCleanCycle(devId: string): Promise<void> {
  const res = await setPurify(devId, false);
  if (!res.ok) throw new Error(res.error ?? 'Could not stop the cleaning cycle.');
  const api = timerApi(devId);
  if (api) await removeTask(api, devId, CLEAN_TASK_ONCE);
  await forgetEnd(devId);
}

/**
 * Mốc kết thúc của chu trình đang chạy (ms), hoặc null nếu không có.
 * Ưu tiên mốc app đã lưu (chính xác tới giây); hết hạn rồi mới hỏi cloud - để bắt được chu trình do máy
 * khác/app Smart Life hẹn.
 */
export async function readCleanCycleEnd(devId: string, now = new Date()): Promise<number | null> {
  const local = await storedEnd(devId);
  if (local != null && local > now.getTime()) return local;

  const api = timerApi(devId);
  if (api && typeof api.getTimerList === 'function') {
    try {
      const list = await api.getTimerList(CLEAN_TASK_ONCE, devId, 'device');
      const pending = (list ?? []).find((t: any) => t?.status !== false && typeof t?.time === 'string');
      if (pending) return nextOccurrence(pending.time, now);
    } catch (e) {
      devLog('getTimerList(once)', e); // Android chưa wire → coi như không có hẹn nào
    }
  }
  return null;
}

/**
 * Lưới an toàn: bồn offline đúng giờ hẹn ⇒ cloud không gửi được lệnh tắt. Mở lại màn hình mà DP 122 còn
 * bật trong khi chu trình đã quá hạn thì app tự tắt. Chỉ áp dụng cho chu trình do CHÍNH app hẹn (có mốc
 * lưu local) - người dùng tự bật nút lá thì không đụng vào.
 * @returns true nếu vừa gửi lệnh tắt bù.
 */
export async function reconcileCleanCycle(
  devId: string,
  purifyOn: boolean,
  now = new Date(),
): Promise<boolean> {
  const end = await storedEnd(devId);
  if (end == null || now.getTime() < end + OVERDUE_GRACE_MS) return false;

  await forgetEnd(devId);
  const api = timerApi(devId);
  if (api) await removeTask(api, devId, CLEAN_TASK_ONCE);
  if (!purifyOn) return false; // cloud đã tắt hộ rồi
  const res = await setPurify(devId, false);
  if (!res.ok) devLog('reconcile setPurify(false)', res.error);
  return res.ok;
}

// ───────────────────────── Lịch vệ sinh ─────────────────────────

/**
 * Đặt (hoặc xoá, khi `schedule = null`) lịch vệ sinh = 2 timer lặp trong cùng task: bật lúc `time`, tắt
 * sau `minutes`. Sửa lịch = xoá task rồi tạo lại, khỏi phải lần theo timerId.
 */
export async function setCleanSchedule(devId: string, schedule: CleanSchedule | null): Promise<void> {
  const api = timerApi(devId);
  if (!api) {
    if (schedule) mockSchedules.set(devId, schedule);
    else mockSchedules.delete(devId);
    return;
  }
  const dp = purifyDp(devId);
  if (!dp) throw new Error('This device has no cleaning control.');

  await removeTask(api, devId, CLEAN_TASK_SCHEDULE);
  if (!schedule) return;

  const off = addMinutesToClock(schedule.time, schedule.minutes);
  if (!off || parseClock(schedule.time) == null || schedule.days.length === 0) {
    throw new Error('Please pick a valid cleaning time and at least one day.');
  }
  const loops = loopsFrom(schedule.days);
  try {
    await api.addTimer(
      timerInput(CLEAN_TASK_SCHEDULE, devId, schedule.time, loops, { [dp]: true }, 'Walrus clean start'),
    );
    await api.addTimer(
      timerInput(
        CLEAN_TASK_SCHEDULE,
        devId,
        off.time,
        off.wrapped ? shiftLoops(loops) : loops, // qua nửa đêm ⇒ tắt vào hôm sau
        { [dp]: false },
        'Walrus clean stop',
      ),
    );
  } catch (e) {
    // Nửa vời (chỉ có timer bật) là trạng thái nguy hiểm nhất ⇒ dọn sạch rồi mới báo lỗi.
    await removeTask(api, devId, CLEAN_TASK_SCHEDULE);
    throw uiError(e, 'Could not save the cleaning schedule.');
  }
}

/** Đọc lịch đang có trên cloud (cặp timer bật/tắt cùng task). Không có / không đọc được → null. */
export async function readCleanSchedule(devId: string): Promise<CleanSchedule | null> {
  const api = timerApi(devId);
  if (!api) return mockSchedules.get(devId) ?? null;
  if (typeof api.getTimerList !== 'function') return null;

  const dp = purifyDp(devId);
  try {
    const list = await api.getTimerList(CLEAN_TASK_SCHEDULE, devId, 'device');
    const valueOf = (t: any): boolean | null => dpBoolOf(t?.dpsJson ?? '{}', dp);
    const on = (list ?? []).find((t: any) => valueOf(t) === true);
    const off = (list ?? []).find((t: any) => valueOf(t) === false);
    if (!on || !off) return null;
    const minutes = minutesBetweenClocks(on.time, off.time);
    if (minutes == null || minutes === 0) return null;
    return { days: daysFromLoops(on.loops), time: on.time, minutes };
  } catch (e) {
    devLog('getTimerList(schedule)', e);
    return null;
  }
}
