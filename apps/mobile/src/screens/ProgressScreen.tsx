import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import { getLevelFromPoints, getLevelName, getStreakMultiplier } from '../state/levels';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import { last7Days, summarizeDay, toISODate } from '../services/ritualStore';
import StatCard from '../components/StatCard';
import PrimaryButton from '../components/PrimaryButton';

type Props = { state: AppState; navigate: Navigate };

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dayLabel(iso: string): string {
  return DOW[new Date(`${iso}T00:00:00`).getDay()];
}

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

// TAB Tracking - record lũy kế (level/points/stats) + tổng hợp theo ngày (hôm nay + 7 ngày).
// Là bottom tab (top-level) nên KHÔNG có nút back; đọc log từ state.sessions (persist).
export default function ProgressScreen({ state, navigate }: Props) {
  const C = useTheme();
  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);
  const progressPct = (pointsInLevel / pointsNeeded) * 100;
  const pointsToNext = pointsNeeded - pointsInLevel;
  const totalHours = Math.floor(state.totalMinutes / 60);
  const remainMins = state.totalMinutes % 60;
  const multiplier = getStreakMultiplier(state.streak);

  const today = toISODate();
  const t = summarizeDay(state.sessions, today);
  const week = last7Days(state.sessions, today);
  const maxSec = Math.max(1, ...week.map((d) => d.seconds));

  const dayStat = (label: string, value: string) => (
    <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 24 }}>{value}</Text>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginTop: 6 }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>TRACKING</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 40, marginBottom: 32 }}>Your Progress</Text>

          {/* Level / points lũy kế */}
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
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 36 }}>
            <StatCard value={totalHours > 0 ? `${totalHours}h ${remainMins} min` : `${state.totalMinutes} min`} label="IN THE COLD" />
          </View>

          {/* Tổng hợp HÔM NAY */}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>TODAY</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26, marginBottom: 18 }}>
            {t.sessions === 0 ? 'No cold today - yet.' : t.sessions === 1 ? '1 session today.' : `${t.sessions} sessions today.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 36 }}>
            {dayStat('SESSIONS', String(t.sessions))}
            {dayStat('TIME', fmtDuration(t.seconds))}
            {dayStat('POINTS', `+${t.points}`)}
          </View>

          {/* 7 ngày gần nhất - cột bar */}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 16 }}>LAST 7 DAYS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130, marginBottom: 8 }}>
            {week.map((d) => {
              const h = Math.round((d.seconds / maxSec) * 100);
              const isToday = d.date === today;
              return (
                <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9 }}>
                    {d.sessions > 0 ? d.sessions : ''}
                  </Text>
                  <View
                    style={{
                      width: 18,
                      height: Math.max(4, h),
                      borderRadius: 6,
                      backgroundColor: d.seconds > 0 ? (isToday ? C.ochre : 'rgba(196,135,58,0.35)') : C.border,
                    }}
                  />
                  <Text style={{ fontFamily: F.body, color: isToday ? C.ochre : C.muted, fontSize: 10 }}>
                    {dayLabel(d.date)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 18, marginBottom: 28, textAlign: 'center' }}>
            {state.streak > 1 ? `${state.streak}-day streak. Keep the ritual.` : 'Show up daily to build a streak.'}
          </Text>

          {state.totalSessions === 0 && (
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 24, textAlign: 'center' }}>
              Complete your first session to begin your record.
            </Text>
          )}

          <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
