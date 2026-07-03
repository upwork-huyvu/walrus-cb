import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { F, useTheme, type Theme } from '../theme';
import type { AppState } from '../state/useAppState';
import { formatTemp } from '../services/deviceSchema';
import StatusPill from './StatusPill';

// Card điều khiển thiết bị cho Dashboard: trạng thái + nhiệt độ hiện tại/mục tiêu + đèn,
// có loading (đọc snapshot) / error+retry / offline + giới hạn target theo schema + chỉ báo pending (đang gửi).
const stepBtn = (C: Theme) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: C.border,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

export default function DeviceCard({ state }: { state: AppState }) {
  const C = useTheme();
  const [showTempControl, setShowTempControl] = useState(false);
  const range = state.tempRange;
  const target = state.targetTemp;
  const offline = state.connStatus === 'offline';
  // Khoá điều khiển khi không ở trạng thái dùng được (offline/connecting/error).
  const controlsDisabled = state.connStatus !== 'online';

  const bump = (delta: number) => {
    if (target == null) return;
    state.setTargetTemp(target + delta);
  };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: C.ochre,
        borderRadius: 16,
        padding: 20,
        backgroundColor: 'rgba(196,135,58,0.06)',
      }}
    >
      {/* Header: tên + chip trạng thái */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Walrus Ice Bath</Text>
        <StatusPill status={state.connStatus} />
      </View>

      {state.deviceError ? (
        // Lỗi đọc thiết bị → message + retry (AC3)
        <View style={{ alignItems: 'center', paddingVertical: 8, gap: 12 }}>
          <Text style={{ fontFamily: F.body, color: '#D9534F', fontSize: 12, textAlign: 'center' }}>
            {state.deviceError}
          </Text>
          <Pressable
            onPress={state.retry}
            style={{ borderWidth: 1, borderColor: C.ochre, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 }}
          >
            <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 13, letterSpacing: 0.5 }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          {/* Tiles: CURRENT / TARGET / LIGHT */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>CURRENT</Text>
              {state.deviceLoading ? (
                <ActivityIndicator color={C.ochre} />
              ) : (
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26 }}>{formatTemp(state.currentTemp, range)}</Text>
              )}
            </View>

            <Pressable
              onPress={() => !controlsDisabled && setShowTempControl((v) => !v)}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: showTempControl ? C.ochre : C.border,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                backgroundColor: showTempControl ? 'rgba(196,135,58,0.08)' : 'transparent',
                opacity: controlsDisabled ? 0.5 : 1,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>TARGET</Text>
              <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 26 }}>{formatTemp(target, range)}</Text>
              {state.pendingTarget != null && (
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, marginTop: 2 }}>sending…</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => !controlsDisabled && state.toggleLight()}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: state.lightOn ? C.ochre : C.border,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                backgroundColor: state.lightOn ? 'rgba(196,135,58,0.08)' : 'transparent',
                opacity: controlsDisabled ? 0.5 : 1,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>LIGHT</Text>
              <Text style={{ fontFamily: F.headline, color: state.lightOn ? C.ochre : C.white, fontSize: 26 }}>
                {state.lightOn ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          {/* Stepper +/- theo schema step; kẹp min/max làm trong setTargetTemp */}
          {showTempControl && !controlsDisabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 24 }}>
              <Pressable onPress={() => bump(-range.step)} style={stepBtn(C)}>
                <Text style={{ color: C.white, fontSize: 20 }}>−</Text>
              </Pressable>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{formatTemp(target, range)}</Text>
              <Pressable onPress={() => bump(range.step)} style={stepBtn(C)}>
                <Text style={{ color: C.white, fontSize: 20 }}>+</Text>
              </Pressable>
            </View>
          )}

          <Text
            style={{
              fontFamily: F.body,
              color: offline ? '#D98A3A' : C.muted,
              fontSize: 10,
              letterSpacing: 3,
              textAlign: 'center',
            }}
          >
            {offline ? 'DEVICE OFFLINE' : 'ECO MODE ACTIVE'}
          </Text>
        </View>
      )}
    </View>
  );
}
