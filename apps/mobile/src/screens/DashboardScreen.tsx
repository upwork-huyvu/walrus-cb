import { useEffect } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { useTheme, F } from '../theme';
import type { AppState } from '../state/useAppState';
import type { Navigate } from '../navigation';
import StatusPill from '../components/StatusPill';
import TempGauge from '../components/TempGauge';
import CleaningPanel from '../components/CleaningPanel';
import FilterReminderCard from '../components/FilterReminderCard';
import { PowerIcon, BulbIcon, LeafIcon } from '../components/DeviceIcons';

type Props = {
  state: AppState;
  navigate: Navigate;
  devId?: string;
  devName?: string;
  userUid?: string;
};

// Màn Device Detail - design "Walrus Pro 2": pill trạng thái + gauge nhiệt + target ± +
// 3 công tắc (đèn/lọc/lạnh) + card cleaning + filter reminder. devId/devName/userUid truyền từ App.
export default function DashboardScreen({ state, navigate, devId, devName, userUid }: Props) {
  const C = useTheme();
  const DARK_ON_GOLD = '#0A0A0F'; // icon trên nền vàng active

  // Mở Device Detail là LUÔN đọc lại snapshot thật (online + DP), không dựa vào state cũ.
  // Vì sao KHÔNG guard theo (devId !== state.devId || !deviceConnected): devId đã persist nên khớp
  // sẵn, còn `deviceConnected` mặc định TRUE do state khởi tạo mock (status:'online') ⇒ guard thành
  // false ⇒ connect bị bỏ ⇒ màn detail đứng nguyên mock (online 12°/6°) dù máy đang offline.
  // connectReqRef trong useAppState đã chống race nên gọi lại mỗi lần mở là an toàn.
  useEffect(() => {
    if (devId) void state.connectDevice(devId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devId]);

  const name = devName || 'Walrus';
  // Pill mode: có nguồn (đang chạy) → Chilling, tắt → Idle. (Thiết bị không có DP freeze riêng;
  // Power = setting_pwr chính là on/off của máy làm lạnh.)
  const mode = state.powerOn ? 'Chilling' : 'Idle';

  // Target hiển thị: state giữ RAW → chia scale (÷10^scale). "°" là glyph riêng bên cạnh.
  const rawTarget = state.pendingTarget ?? state.targetTemp;
  const scale = state.tempRange.scale;
  const dispTarget =
    rawTarget == null ? '-' : (rawTarget / Math.pow(10, scale)).toFixed(scale > 0 ? scale : 0);

  const menu = () => {
    Alert.alert(name, undefined, [
      {
        text: 'Hide device',
        style: 'destructive',
        onPress: () => {
          state.disconnectDevice();
          navigate('device-list');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const bumpTarget = (delta: number) => {
    const base = state.pendingTarget ?? state.targetTemp;
    if (base == null) return;
    state.setTargetTemp(base + delta);
  };

  // Công tắc theo CAPABILITY: chỉ hiện nút thiết bị có DP (Power/Light/Disinfection).
  // Bồn g0cv1c KHÔNG có DP làm-lạnh riêng → không render freeze.
  const toggles = [
    { key: 'power', has: state.caps.power, on: state.powerOn, onPress: state.togglePower, Icon: PowerIcon },
    { key: 'light', has: state.caps.light, on: state.lightOn, onPress: state.toggleLight, Icon: BulbIcon },
    { key: 'purify', has: state.caps.purify, on: state.purifyOn, onPress: state.togglePurify, Icon: LeafIcon },
  ].filter((t) => t.has);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header GIM cố định (ngoài ScrollView) - không cuộn: ‹ + tên thiết bị + ⋮ ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            marginTop: 14,
            marginBottom: 18,
          }}
        >
          <Pressable onPress={() => navigate('device-list')} hitSlop={14} style={{ width: 40 }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, lineHeight: 34 }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 24 }}>{name}</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 4, marginTop: 4 }}>
              ICE BATH
            </Text>
          </View>
          <Pressable onPress={menu} hitSlop={14} style={{ width: 40, alignItems: 'flex-end' }}>
            <Text style={{ color: C.muted, fontSize: 22, lineHeight: 26 }}>⋮</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {state.deviceConnected ? (
            <View>
              {/* ── Status pill ── */}
              <View style={{ alignItems: 'center' }}>
                <StatusPill status={state.connStatus} mode={mode} />
              </View>

              {/* Lỗi đọc/ack → banner + retry (giữ hành vi cũ, không nuốt lỗi) */}
              {state.deviceError ? (
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ fontFamily: F.body, color: '#D9534F', fontSize: 12, textAlign: 'center' }}>
                    {state.deviceError}
                  </Text>
                  <Pressable onPress={state.retry} hitSlop={10} style={{ marginTop: 6 }}>
                    <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 1 }}>RETRY</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* ── Gauge nhiệt độ ── */}
              <View style={{ marginTop: 20 }}>
                <TempGauge
                  current={state.currentTemp}
                  target={state.pendingTarget ?? state.targetTemp}
                  pending={state.pendingTarget != null}
                  range={state.tempRange}
                />
              </View>

              {/* ── TARGET − / + ── */}
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 4 }}>
                  TARGET
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 44,
                    marginTop: 10,
                  }}
                >
                  <Pressable
                    onPress={() => bumpTarget(-state.tempRange.step)}
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 31,
                      borderWidth: 1,
                      borderColor: C.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: C.white, fontSize: 24, lineHeight: 28 }}>−</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', minWidth: 74, justifyContent: 'center' }}>
                    <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 46, lineHeight: 54 }}>
                      {dispTarget}
                    </Text>
                    <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 20, marginTop: 6 }}>°</Text>
                  </View>
                  <Pressable
                    onPress={() => bumpTarget(state.tempRange.step)}
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 31,
                      borderWidth: 1,
                      borderColor: C.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: C.white, fontSize: 24, lineHeight: 28 }}>+</Text>
                  </Pressable>
                </View>
              </View>

              {/* ── 3 công tắc: đèn / lọc / làm lạnh ── */}
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 28,
                  borderRadius: 26,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: 'rgba(245,236,215,0.03)',
                }}
              >
                {toggles.map(({ key, on, onPress, Icon }, i) => (
                  <Pressable
                    key={key}
                    onPress={onPress}
                    style={{
                      flex: 1,
                      height: 72,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? C.ochre : 'transparent',
                      borderLeftWidth: i > 0 ? 1 : 0,
                      borderLeftColor: C.border,
                    }}
                  >
                    <Icon color={on ? DARK_ON_GOLD : C.muted} />
                  </Pressable>
                ))}
              </View>

              {/* ── Cleaning card ── */}
              <View style={{ marginTop: 24 }}>
                <CleaningPanel />
              </View>

              {/* ── Filter reminder card (per-device, backend) ── */}
              <View style={{ marginTop: 16 }}>
                <FilterReminderCard deviceId={devId || state.devId} uid={userUid ?? ''} navigate={navigate} />
              </View>

              {/* ── Nghi thức (ritual) - gộp vào device detail theo IA mới ── */}
              <View style={{ marginTop: 28 }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
                  RITUAL
                </Text>
                <Pressable
                  onPress={() => navigate('session')}
                  style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(196,135,58,0.06)' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 15, letterSpacing: 0.5 }}>Into the cold</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigate('progress')}
                  style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14 }}>Progress</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // Chưa pair → mời sang luồng pairing
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 12 }}>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5, marginBottom: 8 }}>
                Pair your Walrus
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 1, textAlign: 'center', marginBottom: 20 }}>
                No device connected yet.
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
