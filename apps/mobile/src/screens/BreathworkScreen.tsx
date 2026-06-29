import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { getLevelFromPoints, getLevelName, getStreakMultiplier } from '../state/levels';
import { TECHNIQUES, type Technique } from '../state/techniques';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import BreathingCircle from '../components/BreathingCircle';
import GhostButton from '../components/GhostButton';
import PrimaryButton from '../components/PrimaryButton';

type Props = { navigate: Navigate; onComplete: (rounds: number) => void; state: AppState };
type WimPhase = 'breathing' | 'hold' | 'recovery';
type Timer = ReturnType<typeof setInterval> | null;

export default function BreathworkScreen({ navigate, onComplete, state }: Props) {
  const C = useTheme();
  const [selected, setSelected] = useState<Technique | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [, setArcProgress] = useState(0);
  const [customRounds, setCustomRounds] = useState<number | null>(null);
  const [lastPointsEarned, setLastPointsEarned] = useState(0);
  const [wimPhase, setWimPhase] = useState<WimPhase>('breathing');
  const [breathCount, setBreathCount] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [recoveryCount, setRecoveryCount] = useState(15);
  const timerRef = useRef<Timer>(null);
  const holdRef = useRef<Timer>(null);
  const recoveryRef = useRef<Timer>(null);
  const customRoundsRef = useRef<number | null>(null);

  const setCustomRoundsAndRef = (val: number | null) => {
    customRoundsRef.current = val;
    setCustomRounds(val);
  };

  const clearAllTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (holdRef.current) clearInterval(holdRef.current);
    if (recoveryRef.current) clearInterval(recoveryRef.current);
  };

  // Fixed mode timer
  useEffect(() => {
    if (!isPlaying || !selected || selected.mode !== 'fixed') return;
    const phase = selected.phases[phaseIndex];
    const total = phase.duration;
    setCountdown(total);
    setArcProgress(0);
    let seconds = total;
    timerRef.current = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      setArcProgress((total - seconds) / total);
      if (seconds <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setArcProgress(0);
        const nextPhase = phaseIndex + 1;
        if (nextPhase >= selected.phases.length) {
          const nextRound = round + 1;
          if (nextRound > (customRoundsRef.current ?? selected.rounds)) {
            setIsPlaying(false);
            setIsComplete(true);
            const _r = customRoundsRef.current ?? selected.rounds;
            const _pts = Math.round(_r * 10 * getStreakMultiplier(state.streak));
            setLastPointsEarned(_pts);
            onComplete(_r);
          } else {
            setRound(nextRound);
            setPhaseIndex(0);
          }
        } else {
          setPhaseIndex(nextPhase);
        }
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, phaseIndex, round, selected]);

  // Wim Hof: 30 guided breaths
  useEffect(() => {
    if (!isPlaying || selected?.mode !== 'wim' || wimPhase !== 'breathing') return;
    setBreathCount(0);
    setCountdown(2);
    setArcProgress(0);
    let phase: 'in' | 'out' = 'in';
    let count = 0;
    let tick = 2;
    timerRef.current = setInterval(() => {
      tick -= 1;
      setCountdown(tick);
      setArcProgress((2 - tick) / 2);
      if (tick <= 0) {
        if (phase === 'in') {
          phase = 'out';
          tick = 2;
          setPhaseIndex(1);
          setArcProgress(0);
        } else {
          phase = 'in';
          tick = 2;
          count += 1;
          setBreathCount(count);
          setPhaseIndex(0);
          setArcProgress(0);
          if (count >= 30) {
            if (timerRef.current) clearInterval(timerRef.current);
            setWimPhase('hold');
            setHoldSeconds(0);
          }
        }
        setCountdown(tick);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, wimPhase, selected]);

  // Wim Hof: hold — count up
  useEffect(() => {
    if (!isPlaying || selected?.mode !== 'wim' || wimPhase !== 'hold') return;
    holdRef.current = setInterval(() => setHoldSeconds((s) => s + 1), 1000);
    return () => {
      if (holdRef.current) clearInterval(holdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, wimPhase, selected]);

  // Wim Hof: 15s recovery
  useEffect(() => {
    if (!isPlaying || selected?.mode !== 'wim' || wimPhase !== 'recovery') return;
    setRecoveryCount(15);
    setArcProgress(0);
    let secs = 15;
    recoveryRef.current = setInterval(() => {
      secs -= 1;
      setRecoveryCount(secs);
      setArcProgress((15 - secs) / 15);
      if (secs <= 0) {
        if (recoveryRef.current) clearInterval(recoveryRef.current);
        const nextRound = round + 1;
        if (nextRound > (customRoundsRef.current ?? selected.rounds)) {
          setIsPlaying(false);
          setIsComplete(true);
          const _r = customRoundsRef.current ?? selected.rounds;
          const _pts = Math.round(_r * 10 * getStreakMultiplier(state.streak));
          setLastPointsEarned(_pts);
          onComplete(_r);
        } else {
          setRound(nextRound);
          setWimPhase('breathing');
          setBreathCount(0);
        }
      }
    }, 1000);
    return () => {
      if (recoveryRef.current) clearInterval(recoveryRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, wimPhase, selected]);

  const handleSkip = () => {
    clearAllTimers();
    navigate('session');
  };
  const handleBack = () => {
    clearAllTimers();
    if (selected) {
      setSelected(null);
      setIsPlaying(false);
      setWimPhase('breathing');
      setCustomRoundsAndRef(null);
    } else {
      navigate('home');
    }
  };

  // Completion
  if (isComplete && selected) {
    const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);
    const pointsToNext = pointsNeeded - pointsInLevel;

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 28 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>BREATHWORK COMPLETE</Text>
            </View>

            <View style={{ marginBottom: 40, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 52, marginBottom: 14, textAlign: 'center' }}>Well done.</Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
                {selected.id === 'power'
                  ? "Energized. Empowered. Ready for what's next."
                  : 'Grounded and awake. Ready for what’s next.'}
              </Text>
            </View>

            <View style={{ gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: C.ochre,
                  borderRadius: 16,
                  padding: 20,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'rgba(196,135,58,0.07)',
                }}
              >
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>POINTS EARNED</Text>
                <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>+{lastPointsEarned}</Text>
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 16,
                  padding: 20,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>TECHNIQUE</Text>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{selected.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>ROUNDS</Text>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{customRounds ?? selected.rounds}</Text>
                </View>
              </View>

              <View style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 16, padding: 20, backgroundColor: 'rgba(196,135,58,0.06)' }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>YOUR LEVEL</Text>
                <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28, marginBottom: 4 }}>{level}</Text>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13 }}>{getLevelName(level)}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 6 }}>{pointsToNext} to Level {level + 1}</Text>
              </View>
            </View>

            <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
            <View style={{ height: 16 }} />
            <Pressable
              onPress={() => {
                setIsComplete(false);
                setSelected(null);
                setRound(1);
                setPhaseIndex(0);
                setWimPhase('breathing');
                setBreathCount(0);
                setHoldSeconds(0);
                setCustomRoundsAndRef(null);
                setLastPointsEarned(0);
              }}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Do another</Text>
            </Pressable>
            <View style={{ height: 16 }} />
            <GhostButton label="Back to home" onPress={() => navigate('home')} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Player
  if (selected) {
    const isWim = selected.mode === 'wim';
    const totalRounds = customRounds ?? selected.rounds;
    let circleTop = '';
    let circleBottom = '';
    let circleColor = C.white;
    if (!isPlaying) {
      circleTop = selected.name;
      circleBottom = 'TAP TO BEGIN';
    } else if (isWim) {
      if (wimPhase === 'breathing') {
        circleTop = phaseIndex === 0 ? 'Inhale' : 'Exhale';
        circleBottom = `${breathCount} / 30`;
        circleColor = phaseIndex === 0 ? C.ochre : C.white;
      } else if (wimPhase === 'hold') {
        circleTop = `${holdSeconds}s`;
        circleBottom = 'HOLD';
        circleColor = C.ochre;
      } else {
        circleTop = `${recoveryCount}`;
        circleBottom = 'RECOVER';
        circleColor = C.white;
      }
    } else {
      const phase = selected.phases[phaseIndex];
      circleTop = `${countdown}`;
      circleBottom = phase?.label.toUpperCase() ?? '';
      circleColor = phase?.label === 'Inhale' ? C.ochre : C.white;
    }

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 16, marginBottom: 8 }}>
            <Pressable onPress={handleBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>BACK</Text>
            </Pressable>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>ROUND {round} / {totalRounds}</Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            <Pressable
              onPress={() => {
                if (!isPlaying) {
                  setWimPhase('breathing');
                  setBreathCount(0);
                  setHoldSeconds(0);
                  setIsPlaying(true);
                } else if (isWim && wimPhase === 'hold') {
                  if (holdRef.current) clearInterval(holdRef.current);
                  setWimPhase('recovery');
                }
              }}
            >
              <BreathingCircle
                phase={
                  isPlaying
                    ? isWim
                      ? wimPhase === 'hold'
                        ? 'Hold'
                        : wimPhase === 'recovery'
                          ? 'Exhale'
                          : phaseIndex === 0
                            ? 'Inhale'
                            : 'Exhale'
                      : (selected.phases[phaseIndex]?.label ?? 'Hold')
                    : 'Hold'
                }
                duration={isPlaying ? (isWim ? 2 : (selected.phases[phaseIndex]?.duration ?? 4)) : 4}
                isPlaying={isPlaying}
                circleColor={isPlaying ? circleColor : C.ochre}
              >
                <Text
                  style={{
                    fontFamily: F.headline,
                    color: isPlaying ? circleColor : C.white,
                    fontSize: circleTop.length > 6 ? 26 : circleTop.length > 3 ? 34 : 48,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                >
                  {circleTop}
                </Text>
                <Text style={{ fontFamily: F.body, color: !isPlaying ? C.ochre : C.muted, fontSize: 10, letterSpacing: 3, marginTop: 12, textAlign: 'center' }}>
                  {circleBottom}
                </Text>
                {isWim && wimPhase === 'hold' && isPlaying && (
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 9, letterSpacing: 2, marginTop: 8, textAlign: 'center' }}>TAP TO RELEASE</Text>
                )}
              </BreathingCircle>
            </Pressable>

            {/* Round selector */}
            {!isPlaying && (
              <View style={{ marginTop: 28, width: '100%' }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>ROUNDS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  <Pressable
                    onPress={() => setCustomRoundsAndRef(Math.max(1, (customRounds ?? selected.rounds) - 1))}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: C.white, fontSize: 18 }}>−</Text>
                  </Pressable>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32, minWidth: 40, textAlign: 'center' }}>{customRounds ?? selected.rounds}</Text>
                  <Pressable
                    onPress={() => setCustomRoundsAndRef(Math.min(20, (customRounds ?? selected.rounds) + 1))}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: C.white, fontSize: 18 }}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Power phase info */}
            {isWim && !isPlaying && (
              <View style={{ marginTop: 28, width: '100%' }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: 'INHALE', value: '2s' },
                    { label: 'EXHALE', value: '2s' },
                    { label: 'HOLD', value: 'max' },
                    { label: 'RECOVER', value: '15s' },
                  ].map((item) => (
                    <View key={item.label} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 14 }}>{item.value}</Text>
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 8, letterSpacing: 1, marginTop: 4, textAlign: 'center' }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Wim phase bar */}
            {isWim && isPlaying && (
              <View style={{ width: '100%', marginTop: 56 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { key: 'breathing', label: '30 BREATHS', flex: 6 },
                    { key: 'hold', label: 'HOLD', flex: 2 },
                    { key: 'recovery', label: 'RECOVER', flex: 2 },
                  ].map((p) => (
                    <View key={p.key} style={{ flex: p.flex }}>
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: wimPhase === p.key ? C.ochre : C.border, marginBottom: 6 }} />
                      <Text style={{ fontFamily: F.body, color: wimPhase === p.key ? C.ochre : C.muted, fontSize: 9, letterSpacing: 1 }}>{p.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Fixed rhythm bar */}
            {!isWim && selected.phases.length > 0 && (
              <View style={{ width: 220, marginTop: 56 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  {selected.phases.map((p, i) => (
                    <Text key={i} style={{ fontFamily: F.body, color: isPlaying && i === phaseIndex ? C.ochre : C.muted, fontSize: 9, letterSpacing: 1 }}>
                      {p.label.toUpperCase()}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {selected.phases.map((p, i) => {
                    const total = selected.phases.reduce((a, ph) => a + ph.duration, 0);
                    return <View key={i} style={{ flex: p.duration / total, height: 3, borderRadius: 2, backgroundColor: isPlaying && i === phaseIndex ? C.ochre : C.border }} />;
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  {selected.phases.map((p, i) => (
                    <Text key={i} style={{ fontFamily: F.body, color: C.muted, fontSize: 9 }}>{p.duration}s</Text>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={{ paddingHorizontal: 28, paddingBottom: 40, gap: 12 }}>
            {isPlaying && (wimPhase === 'breathing' || selected.mode === 'fixed') && (
              <Pressable
                onPress={() => {
                  clearAllTimers();
                  setIsPlaying(false);
                }}
                style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Pause</Text>
              </Pressable>
            )}

            {!isPlaying &&
              (breathCount > 0 || (selected.mode === 'fixed' && countdown > 0 && countdown < (selected.phases[phaseIndex]?.duration ?? 0))) && (
                <PrimaryButton label="Resume" onPress={() => setIsPlaying(true)} />
              )}

            {!isPlaying && (breathCount > 0 || round > 1 || countdown > 0) && (
              <Pressable
                onPress={() => {
                  clearAllTimers();
                  setIsPlaying(false);
                  setRound(1);
                  setPhaseIndex(0);
                  setWimPhase('breathing');
                  setBreathCount(0);
                  setHoldSeconds(0);
                  setCountdown(0);
                  setArcProgress(0);
                }}
                style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, letterSpacing: 0.5 }}>Reset</Text>
              </Pressable>
            )}

            <GhostButton label="Skip · into the cold" onPress={handleSkip} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Picker
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40 }}>
          <Pressable onPress={() => navigate('home')} style={{ paddingTop: 16, marginBottom: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HOME</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 40, marginBottom: 10 }}>Breathwork</Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 36 }}>
            A few minutes of intentional breath.{'\n'}Before the cold, after it, or simply on its own.
          </Text>

          {TECHNIQUES.map((t) => {
            const isWim = t.mode === 'wim';
            const total = isWim ? 0 : t.phases.reduce((a, p) => a + p.duration, 0);
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setSelected(t);
                  setPhaseIndex(0);
                  setRound(1);
                  setIsComplete(false);
                  setCountdown(0);
                  setWimPhase('breathing');
                  setBreathCount(0);
                  setHoldSeconds(0);
                  setCustomRoundsAndRef(null);
                }}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: pressed ? C.ochre : C.border,
                  borderRadius: 16,
                  padding: 22,
                  marginBottom: 12,
                  backgroundColor: pressed ? 'rgba(196,135,58,0.06)' : 'transparent',
                })}
              >
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22, marginBottom: 4 }}>{t.name}</Text>
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>{t.subtitle}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 }}>{t.description}</Text>
                {isWim ? (
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 1 }}>{t.rounds} rounds · 30 breaths + hold</Text>
                ) : (
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 1 }}>{t.rounds} rounds · {total}s per cycle</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
