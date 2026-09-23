import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { RefreshIcon } from './DeviceIcons';
import CleanScheduleSheet from './CleanScheduleSheet';
import {
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
// Phần ĐẶT LỊCH nằm trong `CleanScheduleSheet` (bánh xe giờ kiểu Smart Life) - card chỉ tóm tắt.
// Bồn chỉ có DP khử trùng bật/tắt (nút lá) ⇒ 1 chu trình = bật + HẸN TẮT TRÊN TUYA CLOUD sau N phút
// (services/cleanCycle.ts). Trạng thái "đang chạy" lấy từ DP thật (`purifyOn`), KHÔNG dùng đồng hồ giả:
// máy tự tắt hay người dùng tắt ở Smart Life thì card cũng phải theo.
type Props = {
  devId?: string;
  /** DP 122 (setting_clr) thật của bồn - nguồn sự thật cho "đang vệ sinh". */
  purifyOn?: boolean;
};

// Hiện theo thứ tự Mon→Sun cho dễ đọc, nhưng giá trị là số của `Date.getDay()` (0 = CN) để khớp
// `loops` của timer Tuya (doc: các chữ số lần lượt là CN → T7 từ trái sang phải).
const DAY_CHIPS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [schedule, setSchedule] = useState<CleanSchedule | null>(null);
  // Độ dài chu trình dùng cho nút chạy tay; lịch mang độ dài riêng của nó (lưu trong `schedule`).
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
      if (saved) setMinutes(saved.minutes); // nút chạy tay theo độ dài đã chọn cho lịch
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
    if (at == null) return 'No automatic cleaning yet - tap EDIT';
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

  /** Lưu (hoặc tắt khi `next = null`) lịch. Chỉ đóng sheet khi Tuya đã nhận. */
  const saveSchedule = async (next: CleanSchedule | null) => {
    if (!devId || busy) return;
    setBusy(true);
    setError('');
    try {
      await setCleanSchedule(devId, next);
      setSchedule(next);
      if (next) setMinutes(next.minutes);
      setSheetOpen(false);
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
        <Pressable
          testID="clean-edit"
          onPress={() => {
            setError('');
            setSheetOpen(true);
          }}
          hitSlop={10}
          disabled={busy || !devId}
        >
          <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 1.5, opacity: devId ? 1 : 0.5 }}>
            EDIT
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

      {error && !sheetOpen ? (
        <Text style={{ fontFamily: F.body, color: '#D9534F', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
          {error}
        </Text>
      ) : null}

      <CleanScheduleSheet
        visible={sheetOpen}
        schedule={schedule}
        defaultMinutes={minutes}
        busy={busy}
        error={error}
        onClose={() => {
          if (busy) return; // đang gọi Tuya → không đóng nửa chừng
          setSheetOpen(false);
          setError('');
        }}
        onSave={(next) => void saveSchedule(next)}
        onTurnOff={() => void saveSchedule(null)}
      />
    </View>
  );
}
