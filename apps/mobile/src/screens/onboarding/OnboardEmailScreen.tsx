import { useState } from 'react';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { F, useTheme } from '../../theme';
import type { Navigate } from '../../navigation';
import PrimaryButton from '../../components/PrimaryButton';

type Props = { navigate: Navigate };

export default function OnboardEmailScreen({ navigate }: Props) {
  const C = useTheme();
  const [email, setEmail] = useState('');
  const isValid = email.includes('@') && email.includes('.');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable onPress={() => navigate('onboard-welcome')} style={{ paddingHorizontal: 40, paddingTop: 24, marginBottom: 48 }}>
          <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 48 }}>Your email.</Text>

          <View style={{ borderBottomWidth: 1, borderBottomColor: isValid ? C.ochre : C.border, paddingBottom: 12, marginBottom: 48 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="hello@yourname.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
              style={{ fontFamily: F.body, color: C.white, fontSize: 18, padding: 0 }}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => {
              if (isValid) navigate('onboard-name');
            }}
          />
          {!isValid && email.length > 0 && (
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              Please enter a valid email address.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
