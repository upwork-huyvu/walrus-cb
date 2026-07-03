import { Linking, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';

type Props = { navigate: Navigate; state: AppState };

// TAB Shop — design menu "Shop · Filters, accessories, parts". FAQ: mua tại walruswellness.com/shop;
// dùng filter chính hãng (third-party có thể hỏng bơm + mất bảo hành).
const SHOP_URL = 'https://walruswellness.com/shop';

const ITEMS = [
  { title: 'Replacement filters', desc: 'Genuine Walrus filters — replace every 90 days.' },
  { title: 'Cleaning tablets', desc: 'Walrus-approved tablets for the clean cycle.' },
  { title: 'Accessories & parts', desc: 'Covers, steps, plumbing spares and more.' },
];

export default function ShopScreen({ state }: Props) {
  const C = useTheme();
  const open = () => {
    void Linking.openURL(SHOP_URL).catch(() => {
      /* không mở được browser — bỏ qua, user thử lại */
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 28, paddingBottom: 32 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            WALRUS WELLNESS
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginBottom: 8 }}>
            Shop.
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 28 }}>
            Filters, accessories, parts.
          </Text>

          {ITEMS.map((it) => (
            <Pressable
              key={it.title}
              onPress={open}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 16, marginBottom: 4 }}>
                  {it.title}
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18 }}>
                  {it.desc}
                </Text>
              </View>
              <Text style={{ color: C.muted, fontSize: 16 }}>↗</Text>
            </Pressable>
          ))}

          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
            Use genuine Walrus filters — third-party filters can damage the pump and void your
            warranty.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
