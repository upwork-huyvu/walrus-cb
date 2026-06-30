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

export default function StatusPill({ status }: { status: ConnStatus }) {
  const C = useTheme();
  const color = colorFor(status, C.muted, C.ochre);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: color,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: F.body, color, fontSize: 10, letterSpacing: 1.5 }}>{LABEL[status]}</Text>
    </View>
  );
}
