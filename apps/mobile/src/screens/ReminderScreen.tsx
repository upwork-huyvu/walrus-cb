import { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import PrimaryButton from '../components/PrimaryButton';
import {
  FILTER_INTERVAL_DAYS,
  FILTER_WARN_DAYS,
  daysLeft,
  getFilterChangedAt,
  markFilterChanged,
} from '../services/filterStore';

type Props = { navigate: Navigate; state: AppState };

// TAB Reminder - filter reminder (design menu "Filter reminder · Next change in 23 days").
// FAQ: thay filter mỗi 90 ngày; nhắc khi còn 7 ngày. Ngày thay lưu local (filterStore).
export default function ReminderScreen({ navigate, state }: Props) {
  const C = useTheme();
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setChangedAt(await getFilterChangedAt());
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const left = changedAt != null ? daysLeft(changedAt) : null;
  const overdue = left != null && left < 0;
  const warn = left != null && left >= 0 && left <= FILTER_WARN_DAYS;
  const pct = left != null ? Math.max(0, Math.min(1, left / FILTER_INTERVAL_DAYS)) : 0;

  const reset = async () => {
    await markFilterChanged();
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 28, paddingBottom: 32 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            MAINTENANCE
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginBottom: 8 }}>
            Filter reminder.
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 30 }}>
            Replace the filter every {FILTER_INTERVAL_DAYS} days to keep your water clear.
          </Text>

          {/* Trạng thái filter */}
          <View style={{ borderWidth: 1, borderColor: overdue ? '#E5484D' : warn ? C.ochre : C.border, borderRadius: 18, padding: 22, marginBottom: 22 }}>
            {!loaded ? null : changedAt == null ? (
              <>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 19, marginBottom: 6 }}>
                  No filter change recorded
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19 }}>
                  Mark when you change the filter and Walrus will remind you {FILTER_WARN_DAYS} days
                  before the next one is due.
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <Text style={{ fontFamily: F.headline, color: overdue ? '#E5484D' : C.white, fontSize: 44 }}>
                    {overdue ? Math.abs(left!) : left}
                  </Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14 }}>
                    {overdue ? 'days overdue' : 'days until next change'}
                  </Text>
                </View>
                {/* progress còn lại */}
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden', marginBottom: 12 }}>
                  <View
                    style={{
                      width: `${Math.round(pct * 100)}%`,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: overdue ? '#E5484D' : warn ? '#E5484D' : C.ochre,
                    }}
                  />
                </View>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12 }}>
                  Last changed {new Date(changedAt).toLocaleDateString()} · every {FILTER_INTERVAL_DAYS} days
                </Text>
                {warn || overdue ? (
                  <Text style={{ fontFamily: F.body, color: overdue ? '#E5484D' : C.ochre, fontSize: 12, marginTop: 8 }}>
                    {overdue ? 'Replace the filter now - water quality may degrade.' : 'Time to order a replacement filter.'}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <PrimaryButton
            label={changedAt == null ? 'I just changed the filter' : 'Mark filter as changed'}
            onPress={() => void reset()}
          />
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Pressable onPress={() => navigate('shop')} hitSlop={8}>
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 13 }}>
                Buy replacement filters →
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
