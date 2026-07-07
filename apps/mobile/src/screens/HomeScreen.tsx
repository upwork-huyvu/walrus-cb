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
import { formatTemp } from '../services/deviceSchema';
import PrimaryButton from '../components/PrimaryButton';
import StatusPill from '../components/StatusPill';

type Props = { state: AppState; navigate: Navigate; userName?: string; onSignOut?: () => void };

export default function HomeScreen({ state, navigate, userName, onSignOut }: Props) {
  const C = useTheme();
  const toggleTheme = useToggleTheme();
  const isDark = C.bg === DARK_THEME.bg;

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

          {/* ── Device summary (chi tiết điều khiển ở Dashboard) ── */}
          {state.deviceConnected ? (
            <Pressable
              onPress={() => navigate('dashboard')}
              style={{
                borderWidth: 1,
                borderColor: C.ochre,
                borderRadius: 16,
                padding: 20,
                marginTop: 16,
                marginBottom: 8,
                backgroundColor: 'rgba(196,135,58,0.06)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Walrus Ice Bath</Text>
                <StatusPill status={state.connStatus} />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>CURRENT</Text>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26 }}>{formatTemp(state.currentTemp, state.tempRange)}</Text>
                </View>
                <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>TARGET</Text>
                  <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 26 }}>{formatTemp(state.targetTemp, state.tempRange)}</Text>
                </View>
              </View>

              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 0.5, textAlign: 'center' }}>
                Open dashboard →
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 16,
                padding: 20,
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              <Pressable onPress={() => navigate('pairing')} style={{ alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5, marginBottom: 6 }}>
                  Pair your Walrus
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>TAP TO CONNECT</Text>
              </Pressable>
            </View>
          )}

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

          {onSignOut && (
            <Pressable onPress={onSignOut} style={{ alignItems: 'center', paddingVertical: 16, marginTop: 8 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 1 }}>Sign out</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
