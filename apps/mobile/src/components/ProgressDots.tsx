import { View } from 'react-native';
import { useTheme } from '../theme';

type Props = { total: number; current: number };

export default function ProgressDots({ total, current }: Props) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 48 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === current ? C.ochre : 'rgba(245,236,215,0.2)',
          }}
        />
      ))}
    </View>
  );
}
