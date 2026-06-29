import { useState } from 'react';
import { SafeAreaView, Text, TextInput, View } from 'react-native';
import { F, useTheme } from '../../theme';
import type { Navigate } from '../../navigation';
import ProgressDots from '../../components/ProgressDots';
import PrimaryButton from '../../components/PrimaryButton';

type Props = { navigate: Navigate; onSetName: (name: string) => void };

export default function OnboardNameScreen({ navigate, onSetName }: Props) {
  const C = useTheme();
  const [name, setName] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={0} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: 40, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>STEP 1 OF 4</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 48 }}>
            What should{'\n'}we call you?
          </Text>

          <View style={{ borderBottomWidth: 1, borderBottomColor: name.length > 0 ? C.ochre : C.border, paddingBottom: 12, marginBottom: 48 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={C.muted}
              autoFocus
              style={{ fontFamily: F.headline, color: C.white, fontSize: 28, padding: 0 }}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => {
              if (name.trim()) {
                onSetName(name.trim());
                navigate('onboard-why');
              }
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
