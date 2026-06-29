import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { formatTime } from '../lib/format';
import type { Navigate } from '../navigation';
import WaterCircle from '../components/WaterCircle';
import PrimaryButton from '../components/PrimaryButton';

type Props = { navigate: Navigate; onComplete: (seconds: number) => void };
type Timer = ReturnType<typeof setInterval> | null;

const RUNNING_COPY = ['Breathe.', 'You are stronger than you think.', 'Sit with it.'];

export default function SessionScreen({ navigate, onComplete }: Props) {
  const C = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copyIndex, setCopyIndex] = useState(0);
  const timerRef = useRef<Timer>(null);
  const copyRef = useRef<Timer>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      copyRef.current = setInterval(() => setCopyIndex((i) => (i + 1) % RUNNING_COPY.length), 30000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (copyRef.current) clearInterval(copyRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (copyRef.current) clearInterval(copyRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const handleFinish = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (copyRef.current) clearInterval(copyRef.current);
    setIsRunning(false);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    onComplete(elapsed);
    navigate('completion', { minutes, seconds: elapsed });
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (copyRef.current) clearInterval(copyRef.current);
    setIsRunning(false);
    setElapsed(0);
    setCopyIndex(0);
  };

  const copy =
    !isRunning && elapsed === 0
      ? 'The cold asks nothing of you\nbut your presence.'
      : isRunning
        ? RUNNING_COPY[copyIndex]
        : 'Take your time.\nThe cold will wait.';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 16 }}>
          <Pressable
            onPress={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              if (copyRef.current) clearInterval(copyRef.current);
              navigate('home');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HOME</Text>
          </Pressable>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>COLD SESSION</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Pressable
            onPress={() => {
              if (!isRunning) setIsRunning(true);
            }}
          >
            <WaterCircle isActive={isRunning} elapsed={elapsed} maxSeconds={180}>
              <Text
                style={{
                  fontFamily: F.headline,
                  color: C.white,
                  fontSize: elapsed >= 3600 ? 32 : 48,
                  textAlign: 'center',
                  includeFontPadding: false,
                }}
              >
                {formatTime(elapsed)}
              </Text>
              <Text
                style={{
                  fontFamily: F.body,
                  color: isRunning ? C.muted : elapsed > 0 ? C.muted : C.ochre,
                  fontSize: 10,
                  letterSpacing: 3,
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                {isRunning ? 'IN THE COLD' : elapsed > 0 ? 'PAUSED' : 'TAP TO BEGIN'}
              </Text>
            </WaterCircle>
          </Pressable>

          <Text
            style={{
              fontFamily: F.body,
              color: C.muted,
              fontSize: 15,
              textAlign: 'center',
              lineHeight: 24,
              marginTop: 48,
              paddingHorizontal: 32,
            }}
          >
            {isRunning ? 'Breathe & Sit with the Cold.' : copy}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 28, paddingBottom: 40 }}>
          <PrimaryButton
            label={elapsed === 0 && !isRunning ? 'Into the cold' : 'Finish session'}
            onPress={elapsed === 0 && !isRunning ? () => setIsRunning(true) : handleFinish}
          />

          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
            {isRunning && (
              <Pressable
                onPress={() => setIsRunning(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Pause</Text>
              </Pressable>
            )}
            {!isRunning && elapsed > 0 && (
              <>
                <Pressable
                  onPress={() => setIsRunning(true)}
                  style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Resume</Text>
                </Pressable>
                <Pressable
                  onPress={handleReset}
                  style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, letterSpacing: 0.5 }}>Reset</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
