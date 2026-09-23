import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { CLEAN_DURATIONS_MIN, type CleanSchedule } from '../services/cleanCycle';

// Bottom-sheet đặt lịch vệ sinh, bám cách Smart Life làm: BÁNH XE chọn giờ (HH:mm, tới từng phút) +
// Repeat theo thứ + độ dài chu trình. Vì sao là sheet riêng chứ không nhét thẳng vào card:
//   1. bánh xe là ScrollView dọc - lồng trong ScrollView dọc của Device Detail thì Android tranh cử chỉ;
//   2. giờ bật LUÔN hiện ngay khi mở (bản cũ giấu sau khi chọn DAILY/WEEKLY nên nhìn như không có).
// Timer Tuya nhận `time` dạng 'HH:mm' (chính xác tới phút) và `loops` lặp theo TUẦN
// → không có "mỗi X ngày", nhưng phút thì tự do, không việc gì phải chặn ở 00/30 như bản cũ.

const ITEM_H = 46; // chiều cao 1 ô của bánh xe
const VISIBLE = 3; //  số ô nhìn thấy (ô giữa = giá trị đang chọn)

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Offset cuộn → chỉ số ô đang nằm giữa, kẹp trong [0, count-1]. Tách riêng để test được. */
export function snapIndex(offsetY: number, itemHeight: number, count: number): number {
  if (!(itemHeight > 0) || count <= 0) return 0;
  const i = Math.round(offsetY / itemHeight);
  return Math.min(count - 1, Math.max(0, i));
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// Thứ hiển thị Mon→Sun cho dễ đọc; giá trị là số của `Date.getDay()` (0 = CN) - khớp `loops` của Tuya
// ("các chữ số lần lượt là Chủ Nhật → Thứ Bảy từ trái sang phải", doc Scheduled Tasks).
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

type WheelProps = { values: number[]; value: number; onChange: (v: number) => void; testID: string };

function Wheel({ values, value, onChange, testID }: WheelProps) {
  const C = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(value));

  // Mở sheet / đổi giá trị từ ngoài → đưa đúng ô vào giữa (không animate, tránh giật lúc mở).
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (y: number) => {
    const next = values[snapIndex(y, ITEM_H, values.length)];
    if (next !== value) onChange(next);
  };

  return (
    <ScrollView
      testID={testID}
      ref={ref}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      // Đệm trên/dưới đúng 1 ô để giá trị đầu và cuối vẫn đứng được ở giữa.
      contentContainerStyle={{ paddingVertical: ITEM_H }}
      onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
      // Kéo chậm thì không có momentum ⇒ phải chốt ở cả scrollEndDrag, không thì giá trị không đổi.
      onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
      style={{ height: ITEM_H * VISIBLE, width: 86 }}
    >
      {values.map((v, i) => (
        <Pressable
          key={v}
          onPress={() => ref.current?.scrollTo({ y: i * ITEM_H, animated: true })}
          style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              fontFamily: F.headline,
              fontSize: v === value ? 30 : 22,
              color: v === value ? C.white : C.muted,
            }}
          >
            {pad2(v)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

type Props = {
  visible: boolean;
  /** Lịch đang lưu trên cloud (null = chưa đặt) - nạp vào sheet mỗi lần mở. */
  schedule: CleanSchedule | null;
  defaultMinutes: number;
  busy: boolean;
  /** Lỗi từ service (Tuya từ chối…) - giữ sheet mở để sửa và thử lại. */
  error: string;
  onClose: () => void;
  onSave: (next: CleanSchedule) => void;
  onTurnOff: () => void;
};

export default function CleanScheduleSheet({
  visible,
  schedule,
  defaultMinutes,
  busy,
  error,
  onClose,
  onSave,
  onTurnOff,
}: Props) {
  const C = useTheme();
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [localError, setLocalError] = useState('');

  // Mở lại → luôn bắt đầu từ lịch ĐANG lưu (không giữ bản nháp của lần đóng trước).
  useEffect(() => {
    if (!visible) return;
    setLocalError('');
    if (schedule) {
      const [h, m] = schedule.time.split(':');
      setHour(Number(h) || 0);
      setMinute(Number(m) || 0);
      setDays(schedule.days.length ? schedule.days : EVERY_DAY);
      setMinutes(schedule.minutes);
    } else {
      setHour(7);
      setMinute(0);
      setDays(EVERY_DAY);
      setMinutes(defaultMinutes);
    }
  }, [visible, schedule, defaultMinutes]);

  const everyDay = days.length === 7;
  const toggleDay = (v: number) =>
    setDays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v]));

  const summary = (): string => {
    const at = `${pad2(hour)}:${pad2(minute)}`;
    if (days.length === 0) return 'Pick at least one day';
    const when = everyDay
      ? 'every day'
      : DAY_CHIPS.filter((d) => days.includes(d.v)).map((d) => d.l).join(', ');
    return `Runs ${when} at ${at} for ${minutes} min`;
  };

  const save = () => {
    if (busy) return;
    if (days.length === 0) {
      setLocalError('Pick at least one day.');
      return;
    }
    setLocalError('');
    onSave({ days, time: `${pad2(hour)}:${pad2(minute)}`, minutes });
  };

  const chip = (label: string, active: boolean, onPress: () => void, key?: string, grow = true) => (
    <Pressable
      key={key ?? label}
      onPress={onPress}
      disabled={busy}
      style={{
        flex: grow ? 1 : undefined,
        paddingVertical: 10,
        paddingHorizontal: grow ? 0 : 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: active ? C.ochre : C.border,
        backgroundColor: active ? 'rgba(196,135,58,0.12)' : 'transparent',
      }}
    >
      <Text style={{ fontFamily: F.body, color: active ? C.ochre : C.muted, fontSize: 11, letterSpacing: 1 }}>
        {label}
      </Text>
    </Pressable>
  );

  const shown = localError || error;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: C.border,
            paddingHorizontal: 22,
            paddingTop: 18,
            paddingBottom: 28,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 20, flex: 1 }}>
              Cleaning schedule
            </Text>
            <Pressable onPress={onClose} hitSlop={12} disabled={busy}>
              <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginBottom: 10 }}>
            {summary()}
          </Text>

          {/* ── Bánh xe giờ bật ── */}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>
            START TIME
          </Text>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {/* Dải sáng ở giữa = ô đang chọn (nằm dưới bánh xe, không chặn cử chỉ). */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                height: ITEM_H,
                left: 24,
                right: 24,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: C.border,
                backgroundColor: 'rgba(196,135,58,0.06)',
                borderRadius: 8,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Wheel testID="clean-hour-wheel" values={HOURS} value={hour} onChange={setHour} />
              <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 26 }}>:</Text>
              <Wheel testID="clean-minute-wheel" values={MINUTES} value={minute} onChange={setMinute} />
            </View>
          </View>

          {/* ── Lặp lại ── */}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginTop: 18, marginBottom: 10 }}>
            REPEAT
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {chip('EVERY DAY', everyDay, () => setDays(everyDay ? [] : EVERY_DAY))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAY_CHIPS.map((d) => chip(d.l, days.includes(d.v), () => toggleDay(d.v), `day-${d.v}`))}
          </View>

          {/* ── Độ dài chu trình ── */}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginTop: 18, marginBottom: 10 }}>
            CYCLE LENGTH
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CLEAN_DURATIONS_MIN.map((m) => chip(`${m} MIN`, minutes === m, () => setMinutes(m), `dur-${m}`))}
          </View>

          {shown ? (
            <Text style={{ fontFamily: F.body, color: '#D9534F', fontSize: 12, marginTop: 14 }}>{shown}</Text>
          ) : null}

          <Pressable
            testID="clean-save-schedule"
            onPress={save}
            disabled={busy}
            style={{
              marginTop: 20,
              borderRadius: 999,
              paddingVertical: 15,
              alignItems: 'center',
              backgroundColor: C.ochre,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14, letterSpacing: 0.5 }}>
                Save schedule
              </Text>
            )}
          </Pressable>

          {schedule ? (
            <Pressable
              testID="clean-turn-off"
              onPress={onTurnOff}
              disabled={busy}
              style={{ paddingVertical: 14, alignItems: 'center', opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Turn schedule off</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
