import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import { getHomeDeviceList, type HomeDevice } from '../services/home';

type Props = { navigate: Navigate; state: AppState; homeId?: number };

// Màn landing sau login (chuẩn Tuya SmartLife): danh sách thiết bị của home hiện tại.
// + Add device → pairing; tap 1 thiết bị → device-detail. Remount (đổi screen) → tự refetch (AC4).
export default function DeviceListScreen({ navigate, state, homeId }: Props) {
  const C = useTheme();
  const [devices, setDevices] = useState<HomeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErr('');
      try {
        setDevices(await getHomeDeviceList(homeId ?? 0));
      } catch (e: any) {
        setErr(e?.message ?? 'Không tải được danh sách thiết bị');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [homeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openDevice = (d: HomeDevice) => {
    void state.connectDevice(d.devId);
    navigate('device-detail', { devId: d.devId });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header: title + Add device (+) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 28,
            marginTop: 36,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>Thiết bị</Text>
          <Pressable
            onPress={() => navigate('pairing', { homeId })}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: C.ochre,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: C.ochre, fontSize: 24, lineHeight: 26 }}>＋</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.ochre} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.ochre} />
            }
          >
            {err ? (
              <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 13, marginBottom: 12 }}>{err}</Text>
            ) : null}

            {devices.length === 0 ? (
              // Empty-state: chưa có thiết bị → CTA thêm thiết bị
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 16, marginBottom: 8 }}>
                  Chưa có thiết bị nào
                </Text>
                <Text
                  style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 24 }}
                >
                  Thêm bồn Walrus của bạn để bắt đầu.
                </Text>
                <Pressable
                  onPress={() => navigate('pairing', { homeId })}
                  style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36 }}
                >
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 14, letterSpacing: 1 }}>
                    THÊM THIẾT BỊ
                  </Text>
                </Pressable>
              </View>
            ) : (
              devices.map((d) => (
                <Pressable
                  key={d.devId}
                  onPress={() => openDevice(d)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 17 }}>
                      {d.name || 'Thiết bị'}
                    </Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginTop: 4 }}>
                      {d.devId}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: d.isOnline ? '#4CAF50' : C.muted,
                      }}
                    />
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 1 }}>
                      {d.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
