import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { F, useTheme } from '../../theme';
import type { Navigate } from '../../navigation';
import ProgressDots from '../../components/ProgressDots';
import GhostButton from '../../components/GhostButton';
import PrimaryButton from '../../components/PrimaryButton';

type Props = { navigate: Navigate; userName?: string };

const OPTIONS = [
  { id: 'recovery', label: 'Recovery', sub: 'Muscle recovery and inflammation' },
  { id: 'performance', label: 'Performance', sub: 'Push further, adapt faster' },
  { id: 'mental', label: 'Mental health', sub: 'Clarity, calm and resilience' },
  { id: 'curiosity', label: 'Curiosity', sub: 'Just getting started' },
];

export default function OnboardWhyScreen({ navigate, userName }: Props) {
  const C = useTheme();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={1} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 40, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>STEP 2 OF 4</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 8 }}>
            Why the cold,{'\n'}{userName}?
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, marginBottom: 36 }}>Choose all that apply.</Text>

          <View style={{ gap: 12, marginBottom: 24 }}>
            {OPTIONS.map((opt) => {
              const isSelected = selected.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggle(opt.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: isSelected ? C.ochre : C.border,
                    borderRadius: 14,
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? 'rgba(196,135,58,0.08)' : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 18, marginBottom: 4 }}>{opt.label}</Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{opt.sub}</Text>
                  </View>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: isSelected ? C.ochre : C.border,
                      backgroundColor: isSelected ? C.ochre : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 12,
                    }}
                  >
                    {isSelected && <Text style={{ color: C.bg, fontSize: 13, lineHeight: 16 }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 12, paddingBottom: 24 }}>
            <PrimaryButton
              label="Continue"
              onPress={() => {
                if (selected.length > 0) navigate('onboard-experience');
              }}
            />
            <GhostButton label="Skip" onPress={() => navigate('onboard-experience')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
