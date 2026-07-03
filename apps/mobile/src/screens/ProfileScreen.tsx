import { useContext } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, Switch, Text, View } from 'react-native';
import { F, ThemeToggleContext, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import type { AuthUser } from '../services/auth';

type Props = {
  navigate: Navigate;
  state: AppState;
  user: AuthUser | null;
  onSignOut: () => void;
};

// Me → Cấu hình thông tin: thông tin tài khoản Tuya (đọc), theme, đăng xuất.
export default function ProfileScreen({ navigate, state, user, onSignOut }: Props) {
  const C = useTheme();
  const toggleTheme = useContext(ThemeToggleContext);

  const row = (label: string, value: string) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: C.border,
        gap: 12,
      }}
    >
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontFamily: F.body, color: C.white, fontSize: 14, flexShrink: 1 }}>
        {value || '—'}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 16, gap: 14 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Profile settings</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          {/* Thông tin tài khoản (đọc — đổi tên/avatar để backlog khi cần) */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 20 }}>
            <View style={{ paddingHorizontal: 18, paddingVertical: 16 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>
                ACCOUNT
              </Text>
            </View>
            {row('Display name', user?.nickName ?? '')}
            {row('Email', user?.email ?? '')}
            {row('UID', user?.uid ?? '')}
          </View>

          {/* Bảo mật: đổi password (Tuya reset-qua-OTP; Google/Apple do provider quản) */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 20 }}>
            <Pressable
              onPress={() => navigate('change-password')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingVertical: 16,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>Change password</Text>
              <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
            </Pressable>
          </View>

          {/* Giao diện */}
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 28 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15 }}>Dark mode</Text>
              <Switch
                value={state.isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: C.border, true: C.ochre }}
                thumbColor={C.white}
              />
            </View>
          </View>

          {/* Đăng xuất */}
          <Pressable
            onPress={onSignOut}
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 14, letterSpacing: 0.5 }}>
              Sign out
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
