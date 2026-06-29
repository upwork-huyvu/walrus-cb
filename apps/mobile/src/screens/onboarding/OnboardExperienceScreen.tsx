import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { F, useTheme } from '../../theme';
import type { Navigate } from '../../navigation';
import ProgressDots from '../../components/ProgressDots';
import GhostButton from '../../components/GhostButton';
import PrimaryButton from '../../components/PrimaryButton';

type Props = { navigate: Navigate };

const OPTIONS = [
  { id: 'first', label: 'First timer', sub: 'Never done this before' },
  { id: 'some', label: 'Some experience', sub: 'Done it a few times' },
  { id: 'regular', label: 'Regular plunger', sub: 'Part of my routine' },
];

export default function OnboardExperienceScreen({ navigate }: Props) {
  const C = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={2} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>STEP 3 OF 4</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 8 }}>
            How familiar{'\n'}are you?
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, marginBottom: 36 }}>Be honest. The cold always knows.</Text>

          <View style={{ gap: 12 }}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setSelected(opt.id)}
                style={{
                  borderWidth: 1,
                  borderColor: selected === opt.id ? C.ochre : C.border,
                  borderRadius: 14,
                  padding: 20,
                  backgroundColor: selected === opt.id ? 'rgba(196,135,58,0.08)' : 'transparent',
                }}
              >
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 18, marginBottom: 4 }}>{opt.label}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{opt.sub}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48, gap: 12 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => {
              if (selected) navigate('onboard-device');
            }}
          />
          <GhostButton label="Skip" onPress={() => navigate('onboard-device')} />
        </View>
      </SafeAreaView>
    </View>
  );
}
