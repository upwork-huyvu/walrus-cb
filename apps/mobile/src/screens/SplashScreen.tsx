import { useEffect, useRef } from 'react';
import { Animated, Image, View } from 'react-native';
import { DARK_THEME, F, useTheme } from '../theme';
import { LOGO_URI, LOGO_URI_LIGHT } from '../lib/format';
import type { Navigate } from '../navigation';

type Props = { navigate: Navigate };

export default function SplashScreen({ navigate }: Props) {
  const C = useTheme();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Image.prefetch(LOGO_URI);

    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(screenOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start(() => navigate('onboard-welcome'));

    return () => {
      logoOpacity.stopAnimation();
      taglineOpacity.stopAnimation();
      screenOpacity.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={{ flex: 1, opacity: screenOpacity, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image
          source={{ uri: C.bg === DARK_THEME.bg ? LOGO_URI : LOGO_URI_LIGHT }}
          style={{ width: 280, height: 62, opacity: logoOpacity }}
          resizeMode="contain"
        />
        <Animated.Text
          style={{
            fontFamily: F.headline,
            color: C.muted,
            fontSize: 12,
            letterSpacing: 3,
            marginTop: 24,
            textAlign: 'center',
            opacity: taglineOpacity,
          }}
        >
          MODERN RITUALS.{'\n'}DESIGNED FOR LIFE.
        </Animated.Text>
      </Animated.View>
    </View>
  );
}
