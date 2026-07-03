import { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import PrimaryButton from '../components/PrimaryButton';
import { createHome } from '../services/home';

type Props = { navigate: Navigate; onHomeCreated?: (homeId: number) => void };

// Màn tạo nhà đầu tiên (chuẩn Tuya SmartLife): hiện KHI user chưa có home nào sau login.
// Tạo xong → vào device-list với homeId vừa tạo.
export default function CreateHomeScreen({ navigate, onHomeCreated }: Props) {
  const C = useTheme();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const canSubmit = name.trim().length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setErr('');
    try {
      const home = await createHome(name.trim());
      onHomeCreated?.(home.homeId);
      navigate('device-list', { homeId: home.homeId, homeName: home.name });
    } catch (e: any) {
      setErr(e?.message ?? 'Could not create home — try again');
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={C.white === '#FFFFFF' ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 32, flexGrow: 1, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 3, marginBottom: 10 }}>
            FIRST STEP
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginBottom: 10 }}>
            Create your home
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 28 }}>
            Your Walrus devices will be added to this home. You are the Owner.
          </Text>

          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 6 }}>Home name</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: C.white,
              fontFamily: F.body,
              fontSize: 16,
              marginBottom: 8,
            }}
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Home"
            placeholderTextColor={C.muted}
            autoFocus
            editable={!loading}
            onSubmitEditing={submit}
            returnKeyType="done"
          />

          {err ? (
            <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 13, marginBottom: 8 }}>{err}</Text>
          ) : null}

          <View style={{ height: 16 }} />
          {loading ? (
            <ActivityIndicator color={C.ochre} />
          ) : (
            <PrimaryButton label="Create home" onPress={submit} disabled={!canSubmit} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
