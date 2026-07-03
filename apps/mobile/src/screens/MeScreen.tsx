import { Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate, ScreenName } from '../navigation';
import type { AppState } from '../state/useAppState';
import type { AuthUser } from '../services/auth';

type Props = { navigate: Navigate; state: AppState; user: AuthUser | null };

// TAB Tôi — bám layout SmartLife (ảnh Me): profile row trên cùng (→ cấu hình thông tin),
// dưới là card menu: Quản lý nhà · Thông báo · Cấu hình thông tin.
const MENU: { glyph: string; label: string; screen: ScreenName }[] = [
  { glyph: '⌂', label: 'Home management', screen: 'home-management' },
  { glyph: '✉', label: 'Notifications', screen: 'notifications' },
  { glyph: '⚙', label: 'Profile settings', screen: 'profile' },
];

export default function MeScreen({ navigate, state, user }: Props) {
  const C = useTheme();
  const displayName = user?.nickName || user?.email || 'Walrus account';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}>
          {/* Profile row: avatar chữ cái đầu + tên (tap → cấu hình thông tin) */}
          <Pressable
            onPress={() => navigate('profile')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 26 }}>
                {displayName.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.headline, color: C.white, fontSize: 24 }}>
                {displayName}
              </Text>
              {user?.email ? (
                <Text numberOfLines={1} style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginTop: 4 }}>
                  {user.email}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
          </Pressable>

          {/* Card menu */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18 }}>
            {MENU.map((m, i) => (
              <Pressable
                key={m.screen}
                onPress={() => navigate(m.screen)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 18,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}
              >
                <Text style={{ fontSize: 17, color: C.ochre, width: 24, textAlign: 'center' }}>{m.glyph}</Text>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, flex: 1 }}>{m.label}</Text>
                <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
