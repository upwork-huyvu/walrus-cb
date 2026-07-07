import { Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { ConnStatus } from '../state/deviceMachine';

// Chip trạng thái kết nối thiết bị (online/offline/connecting/error/idle).
const LABEL: Record<ConnStatus, string> = {
  idle: 'NOT CONNECTED',
  connecting: 'CONNECTING…',
  online: 'ONLINE',
  offline: 'OFFLINE',
  error: 'ERROR',
};

function colorFor(status: ConnStatus, muted: string, ochre: string): string {
  if (status === 'online') return '#4CAF50';
  if (status === 'connecting') return ochre;
  if (status === 'offline') return '#D98A3A';
  if (status === 'error') return '#D9534F';
  return muted;
}

export default function StatusPill({
  status,
  mode,
}: {
  status: ConnStatus;
  /** Chế độ đang chạy (vd "Chilling") - hiện sau dấu | khi online. */
  mode?: string;
}) {
  const C = useTheme();
  const color = colorFor(status, C.muted, C.ochre);
  const showMode = mode != null && status === 'online';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: showMode ? C.border : color,
        backgroundColor: showMode ? 'rgba(245,236,215,0.04)' : 'transparent',
        borderRadius: 999,
        paddingHorizontal: showMode ? 16 : 10,
        paddingVertical: showMode ? 8 : 4,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: F.body, color, fontSize: showMode ? 12 : 10, letterSpacing: 1.5 }}>
        {LABEL[status]}
      </Text>
      {showMode && (
        <>
          <Text style={{ fontFamily: F.body, color: C.border, fontSize: 12, marginHorizontal: 2 }}>|</Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 1 }}>{mode}</Text>
        </>
      )}
    </View>
  );
}
