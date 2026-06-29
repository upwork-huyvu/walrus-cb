import { Text, View } from 'react-native';
import { F, useTheme } from '../theme';

type Props = { value: string | number; label: string };

export default function StatCard({ value, label }: Props) {
  const C = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <Text style={{ color: C.white, fontSize: 28, fontFamily: F.headline }}>
        {value}
      </Text>
      <Text
        style={{
          color: C.muted,
          fontSize: 9,
          fontFamily: F.body,
          letterSpacing: 1,
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
