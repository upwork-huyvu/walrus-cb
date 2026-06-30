import { Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { useTheme, F } from '../theme';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import DeviceCard from '../components/DeviceCard';
import CleaningPanel from '../components/CleaningPanel';

type Props = { state: AppState; navigate: Navigate };

// Màn Dashboard riêng (M1·B5): điều khiển bồn realtime (nhiệt độ + status) + lịch vệ sinh (local).
export default function DashboardScreen({ state, navigate }: Props) {
  const C = useTheme();

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
            <Pressable onPress={() => navigate('home')} hitSlop={12}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, letterSpacing: 0.5 }}>← Home</Text>
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
