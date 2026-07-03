import { Pressable, SafeAreaView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';

type Props = { navigate: Navigate; state: AppState };

// Me → Thông báo (message center). M1: push qua Tuya chưa subscribe (AC4 admin-push) và FCM là M3
// → hiện empty-state; khi có nguồn thông báo thật sẽ đổ list vào đây.
export default function NotificationsScreen({ navigate, state }: Props) {
  const C = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, gap: 14 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Notifications</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 28, marginBottom: 12 }}>✉</Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 18, marginBottom: 8 }}>
            No notifications yet
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center' }}>
            Ritual reminders, device alerts and news from Walrus will appear here.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
