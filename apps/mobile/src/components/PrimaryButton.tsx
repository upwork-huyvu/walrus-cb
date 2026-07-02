import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { F, useTheme } from '../theme';

type Props = { label: string; onPress: () => void; disabled?: boolean };

export default function PrimaryButton({ label, onPress, disabled = false }: Props) {
  const C = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: pressed ? '#A36A28' : C.ochre,
        borderRadius: 14,
        paddingVertical: 20,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: C.white,
          fontSize: 15,
          fontFamily: F.body,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
