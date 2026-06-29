import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { getLevelFromPoints, getLevelName, getStreakMultiplier } from '../state/levels';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import StatCard from '../components/StatCard';
import PrimaryButton from '../components/PrimaryButton';

type Props = { state: AppState; navigate: Navigate };

export default function ProgressScreen({ state, navigate }: Props) {
  const C = useTheme();
  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);
  const progressPct = (pointsInLevel / pointsNeeded) * 100;
  const pointsToNext = pointsNeeded - pointsInLevel;
  const totalHours = Math.floor(state.totalMinutes / 60);
  const remainMins = state.totalMinutes % 60;
  const multiplier = getStreakMultiplier(state.streak);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => navigate('home')} style={{ paddingTop: 16, marginBottom: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HOME</Text>
          </Pressable>

          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>RITUAL RECORD</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 40, marginBottom: 32 }}>Your Progress</Text>

          <View style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 16, padding: 20, marginBottom: 12, backgroundColor: 'rgba(196,135,58,0.06)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 3, marginBottom: 4 }}>LEVEL</Text>
                <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>{level}</Text>
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, marginTop: 4 }}>{getLevelName(level)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>TOTAL POINTS</Text>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.ritualPoints}</Text>
              </View>
            </View>

            <View style={{ height: 2, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden', marginBottom: 8, marginTop: 16 }}>
              <View style={{ height: '100%', width: `${progressPct}%`, backgroundColor: C.ochre }} />
            </View>

            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 1 }}>
              {pointsToNext} pts to Level {level + 1} · {getLevelName(level + 1)}
            </Text>
          </View>

          {state.streak > 0 && (
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>CURRENT MULTIPLIER</Text>
              <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 22 }}>{multiplier}×</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <StatCard value={state.totalSessions} label="SESSIONS" />
            <StatCard value={state.streak} label="DAY STREAK" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
            <StatCard value={totalHours > 0 ? `${totalHours}h ${remainMins} min` : `${state.totalMinutes} min`} label="IN THE COLD" />
            <StatCard value={state.completedBreathworks} label="BREATHWORK" />
          </View>

          {state.totalSessions === 0 && (
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 28 }}>
              Complete your first session to begin your record.
            </Text>
          )}

          <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
          <View style={{ height: 12 }} />
          <Pressable onPress={() => navigate('breathwork')} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}>
            <Text style={{ color: C.white, fontSize: 15, fontFamily: F.body, letterSpacing: 0.5 }}>Breathwork</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
