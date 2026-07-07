import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { BathIcon } from '../components/DeviceIcons';

type Props = {
  navigate: Navigate;
  state: AppState;
  homeId?: number;
  homeName?: string;
  pairedDevice?: HomeDevice;
};

// TAB Thiết bị (landing sau login) - bám layout Tuya SmartLife:
// trên-trái = chọn nhà (⌂ tên nhà ▾ → Quản lý nhà) · trên-phải = ＋ thêm thiết bị;
// thân = danh sách thiết bị / empty-state "Thêm thiết bị đầu tiên". Remount → tự refetch.
export default function DeviceListScreen({ navigate, state, homeId, homeName, pairedDevice }: Props) {
  const C = useTheme();
  const [devices, setDevices] = useState<HomeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const mergePairedDevice = useCallback(
    (list: HomeDevice[]) => {
      if (!pairedDevice?.devId) return list;
      return [pairedDevice, ...list.filter((device) => device.devId !== pairedDevice.devId)];
    },
    [pairedDevice],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErr('');
      // Chưa có homeId (điều hướng bất thường) → không gọi native với id=0; hiện empty-state.
      if (homeId == null) {
        setDevices(mergePairedDevice([]));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        setDevices(mergePairedDevice(await getHomeDeviceList(homeId)));
      } catch (e: any) {
        setDevices(mergePairedDevice([]));
        setErr(e?.message ?? 'Could not load devices');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [homeId, mergePairedDevice],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openDevice = (d: HomeDevice) => {
    // Chỉ điều hướng - device-detail (DashboardScreen) tự connect theo devId (tránh gọi connectDevice 2 lần).
    navigate('device-detail', { devId: d.devId, devName: d.name });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header kiểu SmartLife: chọn nhà (trái) + thêm thiết bị (phải) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            marginTop: 24,
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => navigate('home-management')}
            hitSlop={10}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}
          >
            <Text style={{ fontSize: 18, color: C.white }}>⌂</Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: F.headline, color: C.white, fontSize: 22, flexShrink: 1 }}
            >
              {homeName || 'My Home'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>▾</Text>
          </Pressable>
          <Pressable
            onPress={() => navigate('pairing', { homeId })}
            hitSlop={12}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 1,
              borderColor: C.ochre,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: C.ochre, fontSize: 22, lineHeight: 24 }}>＋</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.ochre} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.ochre} />
            }
          >
            {err ? (
              <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 13, marginBottom: 12 }}>{err}</Text>
            ) : null}

            {devices.length === 0 ? (
              // Empty-state bám ảnh SmartLife: "Add your first device" + CTA "Add Now"
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22, marginBottom: 8 }}>
                  Add your first device
                </Text>
                <Text
                  style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 24 }}
                >
                  Pair your Walrus to begin the ritual.
                </Text>
                <Pressable
                  onPress={() => navigate('pairing', { homeId })}
                  style={{
                    backgroundColor: C.ochre,
                    borderRadius: 24,
                    paddingVertical: 14,
                    paddingHorizontal: 44,
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5 }}>
                    Add now
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
                    gap: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(196,135,58,0.45)',
                    backgroundColor: 'rgba(196,135,58,0.12)',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  {/* Icon: thiết bị thật dùng iconUrl; bồn giả (không url) → icon bồn tắm */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 13,
                      backgroundColor: 'rgba(196,135,58,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {d.iconUrl ? (
                      <Image source={{ uri: d.iconUrl }} style={{ width: 30, height: 30, borderRadius: 8 }} />
                    ) : (
                      <BathIcon color={C.ochre} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 17 }}>
                      {d.name || 'Device'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginTop: 4 }}
                    >
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
