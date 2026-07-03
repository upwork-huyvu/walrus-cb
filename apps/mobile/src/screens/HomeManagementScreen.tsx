import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import { getHomeList, type HomeInfo } from '../services/home';

type Props = { navigate: Navigate; state: AppState; homeId?: number };

function roleLabel(h: HomeInfo): string {
  if (h.admin || h.role === 2) return 'Owner';
  if (h.role === 1) return 'Admin';
  return 'Member';
}

// Me → Quản lý nhà: danh sách nhà của user, đánh dấu nhà hiện tại; tap → chuyển nhà
// (về tab Thiết bị với homeId mới); + Tạo nhà mới → màn create-home.
export default function HomeManagementScreen({ navigate, state, homeId }: Props) {
  const C = useTheme();
  const [homes, setHomes] = useState<HomeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setHomes(await getHomeList());
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load homes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pick = (h: HomeInfo) => {
    // Chuyển nhà hiện tại → về tab Thiết bị của nhà đó (App lưu homeId/homeName qua params).
    navigate('device-list', { homeId: h.homeId, homeName: h.name });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header: back về Me + title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 16, gap: 14 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Home management</Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.ochre} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
            {err ? (
              <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 13, marginBottom: 12 }}>{err}</Text>
            ) : null}

            {homes.map((h) => {
              const isCurrent = h.homeId === homeId;
              return (
                <Pressable
                  key={h.homeId}
                  onPress={() => pick(h)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: isCurrent ? C.ochre : C.border,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 17 }}>
                      {h.name || 'Unnamed home'}
                    </Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginTop: 4 }}>
                      {roleLabel(h)}
                    </Text>
                  </View>
                  {isCurrent ? (
                    <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11, letterSpacing: 1 }}>
                      CURRENT
                    </Text>
                  ) : (
                    <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
                  )}
                </Pressable>
              );
            })}

            {/* Tạo nhà mới */}
            <Pressable
              onPress={() => navigate('create-home')}
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderStyle: 'dashed',
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 14, letterSpacing: 0.5 }}>
                ＋ Create new home
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
