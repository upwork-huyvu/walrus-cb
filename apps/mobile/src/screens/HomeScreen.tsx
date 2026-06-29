import { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { DARK_THEME, F, useTheme, useToggleTheme } from '../theme';
import { getLevelFromPoints, getLevelName } from '../state/levels';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import { LOGO_URI, LOGO_URI_LIGHT } from '../lib/format';
import PrimaryButton from '../components/PrimaryButton';

type Props = { state: AppState; navigate: Navigate; userName?: string };

type CleanState = 'idle' | 'confirm1' | 'confirm2' | 'running' | 'done';

export default function HomeScreen({ state, navigate, userName }: Props) {
  const C = useTheme();
  const toggleTheme = useToggleTheme();
  const isDark = C.bg === DARK_THEME.bg;
  const [showTempControl, setShowTempControl] = useState(false);
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

  const CLEAN_DURATION = 30; // seconds — replace with real cycle time
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const targetTemp = state.targetTemp ?? 0;

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

  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);
  const progressPct = (pointsInLevel / pointsNeeded) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <View style={{ alignItems: 'center', marginTop: 52, marginBottom: 22, height: 50 }}>
            <Image
              source={{ uri: isDark ? LOGO_URI : LOGO_URI_LIGHT }}
              style={{ width: 225, height: 50 }}
              resizeMode="contain"
            />
          </View>

          {/* ── Tagline ── */}
          <View style={{ alignItems: 'center', marginBottom: 44 }}>
            {userName ? (
              <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 13, letterSpacing: 3, textAlign: 'center' }}>
                WELCOME, {userName.toUpperCase()}.
              </Text>
            ) : (
              <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 13, letterSpacing: 3, textAlign: 'center', lineHeight: 22 }}>
                MODERN RITUALS.{'\n'}DESIGNED FOR LIFE.
              </Text>
            )}
          </View>

          {/* ── Ritual record ── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: C.ochre,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              backgroundColor: 'rgba(196,135,58,0.04)',
            }}
          >
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 20 }}>
              RITUAL RECORD
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.totalSessions}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>SESSIONS</Text>
              </View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.streak}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>DAY STREAK</Text>
              </View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.totalMinutes}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>MINUTES</Text>
              </View>
            </View>

            {/* Level + Points */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>LEVEL</Text>
                  <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>{level}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>TOTAL POINTS</Text>
                  <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>{state.ritualPoints}</Text>
                </View>
              </View>
              <View style={{ height: 2, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden', marginBottom: 8 }}>
                <View style={{ height: '100%', width: `${progressPct}%`, backgroundColor: C.ochre }} />
              </View>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                {getLevelName(level)} · {pointsNeeded - pointsInLevel} pts to Level {level + 1}
              </Text>
            </View>

            <Pressable onPress={() => navigate('progress')} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 0.5 }}>View full progress →</Text>
            </Pressable>
          </View>

          {/* ── Actions ── */}
          <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
          <View style={{ height: 16 }} />
          <Pressable
            onPress={() => navigate('breathwork')}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
          >
            <Text style={{ color: C.white, fontSize: 15, fontFamily: F.body, letterSpacing: 0.5 }}>Breathwork</Text>
          </Pressable>

          {/* ── Device card ── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: state.deviceConnected ? C.ochre : C.border,
              borderRadius: 16,
              padding: 20,
              marginTop: 16,
              marginBottom: 8,
              backgroundColor: state.deviceConnected ? 'rgba(196,135,58,0.06)' : 'transparent',
            }}
          >
            {state.deviceConnected ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Walrus Ice Bath</Text>
                  <Pressable onPress={state.disconnectDevice}>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HIDE</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>CURRENT</Text>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26 }}>{state.currentTemp}°C</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowTempControl(!showTempControl)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: showTempControl ? C.ochre : C.border,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: 'center',
                      backgroundColor: showTempControl ? 'rgba(196,135,58,0.08)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>TARGET</Text>
                    <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 26 }}>{targetTemp}°C</Text>
                  </Pressable>
                  <Pressable
                    onPress={state.toggleLight}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: state.lightOn ? C.ochre : C.border,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: 'center',
                      backgroundColor: state.lightOn ? 'rgba(196,135,58,0.08)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>LIGHT</Text>
                    <Text style={{ fontFamily: F.headline, color: state.lightOn ? C.ochre : C.white, fontSize: 26 }}>
                      {state.lightOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>

                {showTempControl && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 24 }}>
                    <Pressable
                      onPress={() => state.setTargetTemp(Math.max(-3, targetTemp - 1))}
                      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.white, fontSize: 20 }}>−</Text>
                    </Pressable>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{targetTemp}°C</Text>
                    <Pressable
                      onPress={() => state.setTargetTemp(Math.min(12, targetTemp + 1))}
                      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.white, fontSize: 20 }}>+</Text>
                    </Pressable>
                  </View>
                )}

                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 3, textAlign: 'center' }}>ECO MODE ACTIVE</Text>

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
            ) : (
              <Pressable onPress={state.connectDevice} style={{ alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5, marginBottom: 6 }}>
                  Pair your Walrus
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>TAP TO CONNECT</Text>
              </Pressable>
            )}
          </View>

          {/* ── Theme switch ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32, marginBottom: 8 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>DARK</Text>
            <Pressable
              onPress={toggleTheme}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                backgroundColor: isDark ? C.border : 'rgba(26,20,16,0.2)',
                borderWidth: 1,
                borderColor: C.border,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: C.ochre,
                  alignSelf: isDark ? 'flex-start' : 'flex-end',
                }}
              />
            </Pressable>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>LIGHT</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
