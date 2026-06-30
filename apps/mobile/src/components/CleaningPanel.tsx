import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { F, useTheme } from '../theme';

// Lịch vệ sinh (ozone clean) — UI local, CHƯA nối Tuya Timer/clean-DP thật (tách feature riêng, Gate ① 2026-06-30).
// Di chuyển nguyên trạng từ HomeScreen sang Dashboard. Khi làm feature cleaning thật: thay setInterval + state local
// bằng TuyaTimer (addTimer/getTimerList) + DP clean thật.
type CleanState = 'idle' | 'confirm1' | 'confirm2' | 'running' | 'done';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CLEAN_DURATION = 30; // giây — thay bằng chu kỳ thật khi nối thiết bị

export default function CleaningPanel() {
  const C = useTheme();
  const [showCleaning, setShowCleaning] = useState(false);
  const [cleanFreq, setCleanFreq] = useState('daily');
  const [cleanHour, setCleanHour] = useState(0);
  const [cleanMinute, setCleanMinute] = useState(0);
  const [cleanEveryDays, setCleanEveryDays] = useState(3);
  const [cleanDay, setCleanDay] = useState('Mon');
  const [timeConfirmed, setTimeConfirmed] = useState(false);
  const [cleanState, setCleanState] = useState<CleanState>('idle');
  const [cleanCountdown, setCleanCountdown] = useState(0);
  const cleanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dọn interval khi unmount (audit M-4): tránh setState trên component đã gỡ + leak nếu rời màn lúc đang "Cleaning…".
  useEffect(
    () => () => {
      if (cleanTimerRef.current) clearInterval(cleanTimerRef.current);
    },
    [],
  );

  const formatCleanTime = () => {
    const h = cleanHour.toString().padStart(2, '0');
    const m = cleanMinute.toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const cleanScheduleLabel = () => {
    if (cleanFreq === 'daily') return `Daily at ${formatCleanTime()}`;
    if (cleanFreq === 'weekly') return `Every ${cleanDay} at ${formatCleanTime()}`;
    return `Every ${cleanEveryDays} days at ${formatCleanTime()}`;
  };

  const startCleaning = () => {
    setCleanState('running');
    setCleanCountdown(CLEAN_DURATION);
    let secs = CLEAN_DURATION;
    cleanTimerRef.current = setInterval(() => {
      secs -= 1;
      setCleanCountdown(secs);
      if (secs <= 0) {
        if (cleanTimerRef.current) clearInterval(cleanTimerRef.current);
        setCleanState('done');
      }
    }, 1000);
  };

  const handleCleanPress = () => {
    if (cleanState === 'idle') {
      setCleanState('confirm1');
      return;
    }
    if (cleanState === 'confirm1') {
      setCleanState('confirm2');
      return;
    }
    if (cleanState === 'confirm2') {
      startCleaning();
      return;
    }
    if (cleanState === 'done') {
      setCleanState('confirm1');
      return;
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const cleanButtonLabel = (): string => {
    if (cleanState === 'idle') return 'Clean now';
    if (cleanState === 'confirm1') return 'Are you sure?';
    if (cleanState === 'confirm2') return 'Tap again to confirm';
    if (cleanState === 'running') return `Cleaning... ${formatCountdown(cleanCountdown)}`;
    if (cleanState === 'done') return 'Clean again?';
    return 'Clean now';
  };

  const cleanButtonColor = (): { border: string; bg: string; text: string } => {
    if (cleanState === 'idle') return { border: C.border, bg: 'transparent', text: C.white };
    if (cleanState === 'confirm1') return { border: C.ochre, bg: 'rgba(196,135,58,0.08)', text: C.ochre };
    if (cleanState === 'confirm2') return { border: C.ochre, bg: 'rgba(196,135,58,0.18)', text: C.ochre };
    if (cleanState === 'running') return { border: C.ochre, bg: 'rgba(196,135,58,0.1)', text: C.ochre };
    if (cleanState === 'done') return { border: '#4CAF50', bg: 'rgba(76,175,80,0.1)', text: '#4CAF50' };
    return { border: C.border, bg: 'transparent', text: C.white };
  };

  return (
    <View>
      {/* ── Cleaning row ── */}
      <Pressable
        onPress={() => setShowCleaning(!showCleaning)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 14,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: C.border,
        }}
      >
        <View>
          <Text style={{ fontFamily: F.body, color: C.white, fontSize: 12, letterSpacing: 0.5 }}>Cleaning</Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 2 }}>{cleanScheduleLabel()}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 14 }}>{showCleaning ? '▲' : '▼'}</Text>
      </Pressable>

      {/* ── Cleaning panel ── */}
      {showCleaning && (
        <View style={{ marginTop: 16, gap: 16 }}>
          {/* Frequency */}
          <View>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>FREQUENCY</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['daily', 'weekly', 'custom'].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setCleanFreq(f)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: cleanFreq === f ? C.ochre : C.border,
                    backgroundColor: cleanFreq === f ? 'rgba(196,135,58,0.1)' : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: cleanFreq === f ? C.ochre : C.muted, fontSize: 11, letterSpacing: 1 }}>
                    {f === 'custom' ? 'CUSTOM' : f.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Custom every X days */}
          {cleanFreq === 'custom' && (
            <View>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>EVERY X DAYS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <Pressable
                  onPress={() => setCleanEveryDays((d) => Math.max(2, d - 1))}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: C.white, fontSize: 18 }}>−</Text>
                </Pressable>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28, minWidth: 40, textAlign: 'center' }}>{cleanEveryDays}</Text>
                <Pressable
                  onPress={() => setCleanEveryDays((d) => Math.min(30, d + 1))}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: C.white, fontSize: 18 }}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Weekly day picker */}
          {cleanFreq === 'weekly' && (
            <View>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>DAY</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DAYS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setCleanDay(d)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: cleanDay === d ? C.ochre : C.border,
                      backgroundColor: cleanDay === d ? 'rgba(196,135,58,0.1)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: cleanDay === d ? C.ochre : C.muted, fontSize: 9 }}>{d}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Time picker */}
          <View>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>TIME</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {/* Hours */}
              <View style={{ alignItems: 'center', width: 72 }}>
                <Pressable
                  onPress={() => { setCleanHour((h) => (h + 1) % 24); setTimeConfirmed(false); }}
                  style={{ padding: 10, width: '100%', alignItems: 'center' }}
                >
                  <Text style={{ color: C.muted, fontSize: 18 }}>▲</Text>
                </Pressable>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32 }}>{cleanHour.toString().padStart(2, '0')}</Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 2, marginTop: 4 }}>HH</Text>
                </View>
                <Pressable
                  onPress={() => { setCleanHour((h) => (h - 1 + 24) % 24); setTimeConfirmed(false); }}
                  style={{ padding: 10, width: '100%', alignItems: 'center' }}
                >
                  <Text style={{ color: C.muted, fontSize: 18 }}>▼</Text>
                </Pressable>
              </View>

              <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 28, marginBottom: 8 }}>:</Text>

              {/* Minutes */}
              <View style={{ alignItems: 'center', width: 72 }}>
                <Pressable
                  onPress={() => { setCleanMinute((m) => (m === 0 ? 30 : 0)); setTimeConfirmed(false); }}
                  style={{ padding: 10, width: '100%', alignItems: 'center' }}
                >
                  <Text style={{ color: C.muted, fontSize: 18 }}>▲</Text>
                </Pressable>
                <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32 }}>{cleanMinute.toString().padStart(2, '0')}</Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 2, marginTop: 4 }}>MM</Text>
                </View>
                <Pressable
                  onPress={() => { setCleanMinute((m) => (m === 0 ? 30 : 0)); setTimeConfirmed(false); }}
                  style={{ padding: 10, width: '100%', alignItems: 'center' }}
                >
                  <Text style={{ color: C.muted, fontSize: 18 }}>▼</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => setTimeConfirmed(true)}
              style={{
                marginTop: 14,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: timeConfirmed ? '#4CAF50' : C.ochre,
                backgroundColor: timeConfirmed ? 'rgba(76,175,80,0.08)' : 'rgba(196,135,58,0.08)',
                opacity: timeConfirmed ? 0.7 : 1,
              }}
            >
              <Text style={{ fontFamily: F.body, fontSize: 13, letterSpacing: 0.5, color: timeConfirmed ? '#4CAF50' : C.ochre }}>
                {timeConfirmed ? 'Time confirmed ✓' : 'Confirm time'}
              </Text>
            </Pressable>
          </View>

          {/* Clean now */}
          <Pressable
            onPress={cleanState === 'running' ? undefined : handleCleanPress}
            style={{
              borderWidth: 1,
              borderColor: cleanButtonColor().border,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: cleanButtonColor().bg,
            }}
          >
            <Text style={{ fontFamily: F.body, color: cleanButtonColor().text, fontSize: 13, letterSpacing: 0.5 }}>
              {cleanButtonLabel()}
            </Text>
            {cleanState === 'confirm2' && (
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 4 }}>
                This will start an ozone clean cycle
              </Text>
            )}
            {cleanState === 'done' && (
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 4 }}>
                Last cleaned just now
              </Text>
            )}
          </Pressable>

          {(cleanState === 'confirm1' || cleanState === 'confirm2') && (
            <Pressable onPress={() => setCleanState('idle')} style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 0.5 }}>Cancel</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
