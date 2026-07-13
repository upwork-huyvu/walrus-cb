import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';
import { getMessages, deleteMessages, type AppMessage } from '../services/messages';
import { markRead } from '../services/notificationsRead';

type Props = { navigate: Navigate; state: AppState; uid?: string; onRead?: () => void };

// Account → Notifications: thông báo THEO USER, GỘP Tuya Message Center + FCM log (backend).
// Mở màn → đánh dấu đã đọc (lastReadAt=now) → badge về 0. Pull-refresh + xoá (Tuya).
export default function NotificationsScreen({ navigate, state, uid, onRead }: Props) {
  const C = useTheme();
  const [items, setItems] = useState<AppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErr('');
      try {
        const page = await getMessages(uid ?? ''); // read-set CŨ → dấu chưa-đọc hiện đúng lần này
        setItems(page.list);
        await markRead(uid ?? '', page.list.map((m) => m.id)); // rồi đánh dấu id đang hiển thị = đã đọc → badge 0
        onRead?.();
      } catch (e: any) {
        setErr(e?.message ?? 'Could not load notifications');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [uid, onRead],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    // Optimistic: bỏ khỏi list ngay; lỗi → nạp lại từ server.
    const prev = items;
    setItems(prev.filter((m) => m.id !== id));
    try {
      await deleteMessages([id], uid ?? '');
    } catch {
      setItems(prev);
    }
  };

  const typeGlyph = (t: string) => (t === 'alarm' ? '⚠' : t === 'family' ? '⌂' : '✉');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 12, gap: 14 }}>
          <Pressable onPress={() => navigate('me')} hitSlop={12}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22 }}>Notifications</Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.ochre} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.ochre} />
            }
          >
            {err ? (
              <Text style={{ fontFamily: F.body, color: '#E5484D', fontSize: 13, marginBottom: 12 }}>{err}</Text>
            ) : null}

            {items.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 28, marginBottom: 12 }}>✉</Text>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 18, marginBottom: 8 }}>
                  No notifications yet
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center' }}>
                  Ritual reminders, device alerts and news from Walrus will appear here.
                </Text>
              </View>
            ) : (
              items.map((m) => (
                <View
                  key={m.id}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 15, color: C.ochre, width: 22, textAlign: 'center' }}>
                    {typeGlyph(m.msgType)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {m.hasNotRead ? (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.ochre }} />
                      ) : null}
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: F.headline, color: C.white, fontSize: 15, flexShrink: 1 }}
                      >
                        {m.title}
                      </Text>
                    </View>
                    {m.content ? (
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                        {m.content}
                      </Text>
                    ) : null}
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 8 }}>
                      {m.dateTime}
                    </Text>
                  </View>
                  <Pressable onPress={() => void remove(m.id)} hitSlop={10}>
                    <Text style={{ color: C.muted, fontSize: 14 }}>✕</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
