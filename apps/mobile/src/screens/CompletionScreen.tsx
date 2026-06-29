import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { getLevelFromPoints, getLevelName, getStreakMultiplier } from '../state/levels';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import GhostButton from '../components/GhostButton';
import PrimaryButton from '../components/PrimaryButton';

type Props = { state: AppState; minutes: number; seconds?: number; navigate: Navigate };

export default function CompletionScreen({ state, minutes, seconds, navigate }: Props) {
  const C = useTheme();
  const actualSeconds = seconds ?? minutes * 60;
  const multiplier = getStreakMultiplier(state.streak);
  const pointsEarned = state.lastSessionPoints;
  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);

  const timeDisplay =
    actualSeconds < 60
      ? `${actualSeconds}s`
      : actualSeconds < 3600
        ? `${Math.floor(actualSeconds / 60)} min ${actualSeconds % 60 > 0 ? `${actualSeconds % 60}s` : ''}`
        : `${Math.floor(actualSeconds / 3600)}h ${Math.floor((actualSeconds % 3600) / 60)} min`;

  const rows: { label: string; value: string; sub: string | null; highlight: boolean }[] = [
    { label: 'POINTS EARNED', value: `+${pointsEarned}`, sub: multiplier > 1 ? `${multiplier}× streak bonus` : null, highlight: true },
    { label: 'TIME IN COLD', value: timeDisplay, sub: null, highlight: false },
    { label: 'STREAK', value: `${state.streak} ${state.streak === 1 ? 'day' : 'days'}`, sub: null, highlight: state.streak >= 2 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 28 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>SESSION COMPLETE</Text>
          </View>

          <View style={{ marginBottom: 48, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 52, marginBottom: 14, textAlign: 'center' }}>Well done.</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>Stillness is the work.</Text>
          </View>

          <View style={{ gap: 10, marginBottom: 32 }}>
            {rows.map((row) => (
              <View
                key={row.label}
                style={{
                  borderWidth: 1,
                  borderColor: row.highlight ? C.ochre : C.border,
                  borderRadius: 16,
                  padding: 20,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: row.highlight ? 'rgba(196,135,58,0.07)' : 'transparent',
                }}
              >
                <View>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>{row.label}</Text>
                  {row.sub ? <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 10, marginTop: 2 }}>{row.sub}</Text> : null}
                </View>
                <Text style={{ fontFamily: F.headline, color: row.highlight ? C.ochre : C.white, fontSize: 28 }}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 16, padding: 20, marginBottom: 32, backgroundColor: 'rgba(196,135,58,0.06)' }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>YOUR LEVEL</Text>
            <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28, marginBottom: 4 }}>{level}</Text>
            <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13 }}>{getLevelName(level)}</Text>
            <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, marginTop: 6 }}>{state.ritualPoints.toLocaleString()} total</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 4 }}>{pointsNeeded - pointsInLevel} to Level {level + 1}</Text>
          </View>

          <PrimaryButton label="View progress" onPress={() => navigate('progress')} />
          <View style={{ height: 12 }} />
          <GhostButton label="Back to home" onPress={() => navigate('home')} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
