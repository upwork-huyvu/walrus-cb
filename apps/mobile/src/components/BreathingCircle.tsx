import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

// Expands on inhale, holds, contracts on exhale — circle IS the guide.
type Props = {
  phase: string;
  duration: number;
  isPlaying: boolean;
  circleColor: string;
  children?: ReactNode;
};

export default function BreathingCircle({
  phase,
  duration,
  isPlaying,
  circleColor,
  children,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.stopAnimation();
    glowOpacity.stopAnimation();

    if (!isPlaying) {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
      return;
    }

    const ms = duration * 1000;

    if (phase === 'Inhale') {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1.22, duration: ms, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.55, duration: ms, useNativeDriver: true }),
      ]).start();
    } else if (phase === 'Exhale') {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.82, duration: ms, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.05, duration: ms, useNativeDriver: true }),
      ]).start();
    } else if (phase === 'Hold') {
      Animated.timing(glowOpacity, { toValue: 0.45, duration: 600, useNativeDriver: true }).start();
    } else {
      Animated.timing(glowOpacity, { toValue: 0.2, duration: 800, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPlaying, duration]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 260, height: 260 }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: circleColor,
          opacity: glowOpacity,
          transform: [{ scale: scaleAnim }],
        }}
      />
      <Animated.View
        style={{
          width: 220,
          height: 220,
          borderRadius: 110,
          borderWidth: 1.5,
          borderColor: circleColor,
          backgroundColor: 'rgba(10,10,15,0.92)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
