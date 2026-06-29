import { SafeAreaView, Text, View } from 'react-native';
import { F, useTheme } from '../../theme';
import type { Navigate } from '../../navigation';
import ProgressDots from '../../components/ProgressDots';
import GhostButton from '../../components/GhostButton';
import PrimaryButton from '../../components/PrimaryButton';

// userName giữ trong props cho khớp gốc (chưa dùng tới — sẽ dùng khi cá nhân hoá).
type Props = { navigate: Navigate; userName?: string };

export default function OnboardDeviceScreen({ navigate }: Props) {
  const C = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={3} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>STEP 4 OF 4</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 12 }}>
            Pair your{'\n'}Walrus.
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, marginBottom: 48 }}>
            Set your temperature from anywhere. By the time you arrive, your Ice Bath is ready.
          </Text>

          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 28, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22, marginBottom: 8 }}>Walrus Ice Bath</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Make sure your Ice Bath and phone are connected to the same Wi-Fi network.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48, gap: 12 }}>
          <PrimaryButton label="Pair now" onPress={() => navigate('home')} />
          <GhostButton label="Skip for now" onPress={() => navigate('home')} />
        </View>
      </SafeAreaView>
    </View>
  );
}
