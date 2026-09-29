import { Linking, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '../config/legal';

type Props = { navigate: Navigate; state: AppState };

// Account → Privacy & terms. Store review (Apple 5.1.1 / Google User Data policy) yêu cầu privacy
// policy mở được từ trong app. Nội dung nằm trên website Walrus → mở trình duyệt, không nhúng bản sao.
const ROWS: { glyph: string; label: string; detail: string; url: string }[] = [
  { glyph: '◐', label: 'Privacy Policy', detail: 'How we collect and use your data', url: PRIVACY_POLICY_URL },
  { glyph: '§', label: 'Terms and Conditions', detail: 'The rules for using Walrus', url: TERMS_URL },
  { glyph: '✉', label: 'Contact us', detail: SUPPORT_EMAIL, url: `mailto:${SUPPORT_EMAIL}` },
];

export default function LegalScreen({ navigate, state }: Props) {
  const C = useTheme();

  const open = (url: string) => {
    void Linking.openURL(url).catch(() => {
      /* không có trình duyệt / mail app - bỏ qua */
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 16, gap: 14 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Privacy & terms</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18 }}>
            {ROWS.map((r, i) => (
              <Pressable
                key={r.label}
                onPress={() => open(r.url)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}
              >
                <Text style={{ fontSize: 17, color: C.ochre, width: 24, textAlign: 'center' }}>{r.glyph}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>{r.label}</Text>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, marginTop: 3 }}>{r.detail}</Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 16 }}>↗</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 18 }}>
            You can delete your account and its data at any time from Profile settings → Delete account.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
