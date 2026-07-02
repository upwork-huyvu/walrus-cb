import { useEffect } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { useTheme, F } from '../theme';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import DeviceCard from '../components/DeviceCard';
import CleaningPanel from '../components/CleaningPanel';

type Props = { state: AppState; navigate: Navigate; devId?: string };

// Màn Device Detail (M1·B5/B6): điều khiển bồn realtime (nhiệt độ + status) + lịch vệ sinh (local).
// devId truyền từ Device List → đảm bảo kết nối đúng thiết bị được chọn (AC5).
export default function DashboardScreen({ state, navigate, devId }: Props) {
  const C = useTheme();

  // Mở từ Device List: nếu devId khác thiết bị đang kết nối → kết nối lại đúng thiết bị.
  useEffect(() => {
    if (devId && devId !== state.devId) {
      void state.connectDevice(devId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devId]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header: back + title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 36, marginBottom: 28 }}>
            <Pressable onPress={() => navigate('device-list')} hitSlop={12}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, letterSpacing: 0.5 }}>← Thiết bị</Text>
            </Pressable>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 13, letterSpacing: 3 }}>DASHBOARD</Text>
            <View style={{ width: 52 }} />
          </View>

          {state.deviceConnected ? (
            <View>
              <DeviceCard state={state} />
              {/* Lịch vệ sinh (local, tách feature riêng) — chỉ hiện khi thiết bị đã kết nối */}
              <View
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  paddingBottom: 8,
                  marginTop: 16,
                }}
              >
                <CleaningPanel />
              </View>

              {/* ── Nghi thức (ritual) — gộp vào device detail theo IA mới ── */}
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
                  NGHI THỨC
                </Text>
                <Pressable
                  onPress={() => navigate('session')}
                  style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(196,135,58,0.06)' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 15, letterSpacing: 0.5 }}>Into the cold</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => navigate('breathwork')}
                    style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14 }}>Breathwork</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigate('progress')}
                    style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14 }}>Tiến trình</Text>
                  </Pressable>
                </View>
              </View>

              {/* Ngắt/ẩn thiết bị */}
              <Pressable onPress={state.disconnectDevice} style={{ alignItems: 'center', paddingVertical: 18, marginTop: 8 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 2 }}>HIDE DEVICE</Text>
              </Pressable>
            </View>
          ) : (
            // Chưa pair → mời sang luồng pairing
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 12 }}>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5, marginBottom: 8 }}>
                Pair your Walrus
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 1, textAlign: 'center', marginBottom: 20 }}>
                Chưa có thiết bị nào được kết nối.
              </Text>
              <Pressable
                onPress={() => navigate('pairing')}
                style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36 }}
              >
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 14, letterSpacing: 1 }}>CONNECT</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
