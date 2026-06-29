import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, SafeAreaView, Text, View } from 'react-native';
import { DARK_THEME, F, useTheme } from '../../theme';
import { LOGO_URI, LOGO_URI_LIGHT } from '../../lib/format';
import type { Navigate } from '../../navigation';

type Props = { navigate: Navigate };

export default function OnboardWelcomeScreen({ navigate }: Props) {
  const C = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={{ flex: 1, opacity }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Image
              source={{ uri: C.bg === DARK_THEME.bg ? LOGO_URI : LOGO_URI_LIGHT }}
              style={{ width: 280, height: 62, marginBottom: 48 }}
              resizeMode="contain"
            />
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, lineHeight: 42, marginBottom: 16, textAlign: 'center' }}>
              The ritual{'\n'}starts here.
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              Cold. Breath. Presence.{'\n'}Every day.
            </Text>
          </View>

          {/* Auth buttons — wiring native Google/Apple sign-in ở m1-mobile-auth (B2 feature) */}
          <View style={{ paddingHorizontal: 40, paddingBottom: 48, gap: 12 }}>
            <Pressable
              onPress={() => navigate('onboard-name')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 14,
                paddingVertical: 18,
                gap: 10,
                backgroundColor: pressed ? 'rgba(245,236,215,0.05)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 16 }}>G</Text>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5 }}>Continue with Google</Text>
            </Pressable>

            <Pressable
              onPress={() => navigate('onboard-name')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 14,
                paddingVertical: 18,
                gap: 10,
                backgroundColor: pressed ? 'rgba(245,236,215,0.05)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 16, color: C.white }}></Text>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5 }}>Continue with Apple</Text>
            </Pressable>

            <Pressable onPress={() => navigate('onboard-email')} style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, letterSpacing: 0.5 }}>Continue with email</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
