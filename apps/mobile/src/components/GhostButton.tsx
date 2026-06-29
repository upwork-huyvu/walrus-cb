import { Pressable, Text } from 'react-native';
import { F, useTheme } from '../theme';

type Props = { label: string; onPress: () => void };

export default function GhostButton({ label, onPress }: Props) {
  const C = useTheme();
  return (
    <Pressable onPress={onPress} style={{ padding: 16, alignItems: 'center' }}>
      <Text
        style={{
          color: C.muted,
          fontSize: 13,
          fontFamily: F.body,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
