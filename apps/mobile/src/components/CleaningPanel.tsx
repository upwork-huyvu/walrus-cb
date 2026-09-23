import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { RefreshIcon } from './DeviceIcons';
import {
  CLEAN_DURATIONS_MIN,
  DEFAULT_CLEAN_MINUTES,
  clockTime,
  nextScheduleRun,
  readCleanCycleEnd,
  readCleanSchedule,
  reconcileCleanCycle,
  setCleanSchedule,
  startCleanCycle,
  stopCleanCycle,
  type CleanSchedule,
} from '../services/cleanCycle';

// Card CLEANING (design "Walrus Pro 2"): lịch vệ sinh + "Run clean cycle now".
// Bồn chỉ có DP khử trùng bật/tắt (nút lá) ⇒ 1 chu trình = bật + HẸN TẮT TRÊN TUYA CLOUD sau N phút
// (services/cleanCycle.ts). Trạng thái "đang chạy" lấy từ DP thật (`purifyOn`), KHÔNG dùng đồng hồ giả:
// máy tự tắt hay người dùng tắt ở Smart Life thì card cũng phải theo.
type Props = {
  devId?: string;
  /** DP 122 (setting_clr) thật của bồn - nguồn sự thật cho "đang vệ sinh". */
  purifyOn?: boolean;
};

type Freq = 'off' | 'daily' | 'weekly';

// Hiện theo thứ tự Mon→Sun cho dễ đọc, nhưng giá trị là số của `Date.getDay()` (0 = CN) để khớp
// `loops` của timer Tuya.
const DAY_CHIPS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const pad2 = (n: number): string => String(n).padStart(2, '0');

const scheduleLabel = (s: CleanSchedule | null): string => {
  if (!s || s.days.length === 0) return 'No cleaning schedule';
  if (s.days.length === 7) return `Daily at ${s.time}`;
  const names = DAY_CHIPS.filter((d) => s.days.includes(d.v)).map((d) => d.l).join(', ');
  return `${names} at ${s.time}`;
};

const errorText = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message ? e.message : fallback;

export default function CleaningPanel({ devId, purifyOn = false }: Props) {
  const C = useTheme();
  const [editing, setEditing] = useState(false);
  const [schedule, setSchedule] = useState<CleanSchedule | null>(null);
  const [freq, setFreq] = useState<Freq>('off');
  const [days, setDays] = useState<number[]>([1]);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [minutes, setMinutes] = useState(DEFAULT_CLEAN_MINUTES);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(0); // 0 = chưa bấm, 1 → 2 = hai bước xác nhận
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Tick mỗi phút để "Next cycle in…" tự đếm lùi.
  const [, setMinuteTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Mở card là đọc trạng thái THẬT: hẹn tắt đang chờ + lịch trên cloud.
  useEffect(() => {
    if (!devId) return;
    let alive = true;
    void (async () => {
      const [end, saved] = await Promise.all([readCleanCycleEnd(devId), readCleanSchedule(devId)]);
      if (!alive) return;
      setEndsAt(end);
      setSchedule(saved);
      if (saved) {
        setFreq(saved.days.length === 7 ? 'daily' : 'weekly');
        setDays(saved.days);
        setMinutes(saved.minutes);
        const [h, m] = saved.time.split(':');
        setHour(Number(h) || 0);
        setMinute(Number(m) || 0);
      }
    })();
    return () => {
      alive = false;
    };
  }, [devId]);

  // Lưới an toàn: bồn offline đúng giờ hẹn ⇒ cloud lỡ lệnh tắt. Mở lại màn hình thì tắt bù.
  useEffect(() => {
    if (!devId) return;
    void reconcileCleanCycle(devId, purifyOn).then((stopped) => {
      if (stopped) setEndsAt(null);
    });
  }, [devId, purifyOn]);

  const nextLabel = (): string => {
    const at = nextScheduleRun(schedule, new Date());
    if (at == null) return 'Tap EDIT to clean automatically';
    const mins = Math.max(1, Math.round((at - Date.now()) / 60_000));
    const h = Math.floor(mins / 60);
    return h > 0 ? `Next cycle in ${h}h ${mins % 60}m` : `Next cycle in ${mins}m`;
  };

  const runCycle = async () => {
    if (!devId || busy) return;
    setBusy(true);
    setError('');
    try {
      setEndsAt(await startCleanCycle(devId, minutes));
    } catch (e) {
      setError(errorText(e, 'Could not start the cleaning cycle.'));
    } finally {
      setConfirm(0);
      setBusy(false);
    }
  };

  const stopCycle = async () => {
    if (!devId || busy) return;
    setBusy(true);
    setError('');
    try {
      await stopCleanCycle(devId);
      setEndsAt(null);
    } catch (e) {
      setError(errorText(e, 'Could not stop the cleaning cycle.'));
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    if (!devId || busy) return;
    const next: CleanSchedule | null =
      freq === 'off'
        ? null
        : { days: freq === 'daily' ? EVERY_DAY : days, time: `${pad2(hour)}:${pad2(minute)}`, minutes };
    if (next && next.days.length === 0) {
      setError('Pick at least one day.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setCleanSchedule(devId, next);
      setSchedule(next);
      setEditing(false);
    } catch (e) {
      setError(errorText(e, 'Could not save the cleaning schedule.'));
    } finally {
      setBusy(false);
    }
  };

  const onMainPress = () => {
    if (busy) return;
    if (purifyOn) {
      void stopCycle();
      return;
    }
    if (confirm < 2) {
      setConfirm(confirm + 1);
      return;
    }
    void runCycle();
  };

  const mainLabel = (): string => {
    if (busy) return 'Working…';
    if (purifyOn) return endsAt ? `Stop cleaning (until ${clockTime(new Date(endsAt))})` : 'Stop cleaning';
    if (confirm === 1) return 'Are you sure?';
    if (confirm === 2) return 'Tap again to confirm';
    return 'Run clean cycle now';
  };

  const mainColor = (): { border: string; bg: string; text: string } => {
    if (purifyOn) return { border: C.ochre, bg: 'rgba(196,135,58,0.18)', text: C.ochre };
    if (confirm > 0) return { border: C.ochre, bg: 'rgba(196,135,58,0.08)', text: C.ochre };
    return { border: C.border, bg: 'transparent', text: C.white };
  };

  const chip = (label: string, active: boolean, onPress: () => void, key?: string) => (
    <Pressable
      key={key ?? label}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: active ? C.ochre : C.border,
        backgroundColor: active ? 'rgba(196,135,58,0.1)' : 'transparent',
      }}
    >
      <Text style={{ fontFamily: F.body, color: active ? C.ochre : C.muted, fontSize: 11, letterSpacing: 1 }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: 'rgba(245,236,215,0.03)',
        borderRadius: 24,
        padding: 20,
      }}
    >
      {/* ── Header: CLEANING + EDIT ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>CLEANING</Text>
        <Pressable onPress={() => setEditing(!editing)} hitSlop={10} disabled={busy}>
          <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 1.5 }}>
            {editing ? 'CLOSE' : 'EDIT'}
          </Text>
        </Pressable>
      </View>

      {/* ── Lịch + mốc chạy kế tiếp ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(196,135,58,0.45)',
            backgroundColor: 'rgba(196,135,58,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RefreshIcon color={C.ochre} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 20 }}>{scheduleLabel(schedule)}</Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginTop: 3 }}>
            {purifyOn
              ? endsAt
                ? `Cleaning… until ${clockTime(new Date(endsAt))}`
                : 'Cleaning…'
              : nextLabel()}
          </Text>
        </View>
      </View>

      {/* ── Editor (EDIT) ── */}
      {editing && (
        <View style={{ marginTop: 18, gap: 16 }}>
          <View>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>
              SCHEDULE
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {chip('OFF', freq === 'off', () => setFreq('off'))}
              {chip('DAILY', freq === 'daily', () => setFreq('daily'))}
              {chip('WEEKLY', freq === 'weekly', () => setFreq('weekly'))}
            </View>
          </View>

          {/* Chọn thứ - timer Tuya lặp theo TUẦN nên không có "mỗi X ngày". */}
          {freq === 'weekly' && (
            <View>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>
                DAYS
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DAY_CHIPS.map((d) =>
                  chip(
                    d.l,
                    days.includes(d.v),
                    () => setDays(days.includes(d.v) ? days.filter((x) => x !== d.v) : [...days, d.v]),
                    `day-${d.v}`,
                  ),
                )}
              </View>
            </View>
          )}

          {/* Thời lượng: dùng cho cả lịch lẫn nút chạy tay. */}
          <View>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>
              CYCLE LENGTH
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CLEAN_DURATIONS_MIN.map((m) => chip(`${m} MIN`, minutes === m, () => setMinutes(m), `dur-${m}`))}
            </View>
          </View>

          {/* Giờ bật */}
          {freq !== 'off' && (
            <View>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>
                START TIME
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <View style={{ alignItems: 'center', width: 72 }}>
                  <Pressable onPress={() => setHour((h) => (h + 1) % 24)} style={{ padding: 10, width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: C.muted, fontSize: 18 }}>▲</Text>
                  </Pressable>
                  <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32 }}>{pad2(hour)}</Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 2, marginTop: 4 }}>HH</Text>
                  </View>
                  <Pressable onPress={() => setHour((h) => (h + 23) % 24)} style={{ padding: 10, width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: C.muted, fontSize: 18 }}>▼</Text>
                  </Pressable>
                </View>

                <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 28, marginBottom: 8 }}>:</Text>

                <View style={{ alignItems: 'center', width: 72 }}>
                  <Pressable onPress={() => setMinute((m) => (m === 0 ? 30 : 0))} style={{ padding: 10, width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: C.muted, fontSize: 18 }}>▲</Text>
                  </Pressable>
                  <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32 }}>{pad2(minute)}</Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 2, marginTop: 4 }}>MM</Text>
                  </View>
                  <Pressable onPress={() => setMinute((m) => (m === 0 ? 30 : 0))} style={{ padding: 10, width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: C.muted, fontSize: 18 }}>▼</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          <Pressable
            testID="clean-save-schedule"
            onPress={() => void saveSchedule()}
            disabled={busy || !devId}
            style={{
              borderRadius: 12,
              paddingVertical: 13,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: C.ochre,
              backgroundColor: 'rgba(196,135,58,0.08)',
              opacity: busy || !devId ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={C.ochre} />
            ) : (
              <Text style={{ fontFamily: F.body, fontSize: 13, letterSpacing: 0.5, color: C.ochre }}>
                {freq === 'off' ? 'Turn schedule off' : 'Save schedule'}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ── Run / Stop ── */}
      <Pressable
        testID="clean-run"
        onPress={onMainPress}
        disabled={busy || !devId}
        style={{
          marginTop: 18,
          borderWidth: 1,
          borderColor: mainColor().border,
          borderRadius: 999,
          paddingVertical: 16,
          alignItems: 'center',
          backgroundColor: mainColor().bg,
          opacity: !devId ? 0.5 : 1,
        }}
      >
        <Text style={{ fontFamily: F.body, color: mainColor().text, fontSize: 14, letterSpacing: 0.3 }}>
          {mainLabel()}
        </Text>
        {confirm === 2 && !purifyOn && (
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 4 }}>
            {`Disinfection will run for ${minutes} minutes, then switch off`}
          </Text>
        )}
      </Pressable>

      {confirm > 0 && !purifyOn && (
        <Pressable onPress={() => setConfirm(0)} style={{ alignItems: 'center', paddingTop: 10 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 0.5 }}>Cancel</Text>
        </Pressable>
      )}

      {error ? (
        <Text style={{ fontFamily: F.body, color: '#D9534F', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
