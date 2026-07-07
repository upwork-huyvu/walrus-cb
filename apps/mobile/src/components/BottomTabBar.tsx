import { Pressable, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate, ScreenName } from '../navigation';
import { IconDevice, IconTracking, IconShop, IconHelp, IconAccount } from './TabIcons';

export type TabKey = 'device' | 'tracking' | 'shop' | 'help' | 'account';

type Props = { active: TabKey; navigate: Navigate; unread?: number };

const BADGE_RED = '#E5484D';

// Bottom tab 5 mục: Device · Tracking · Shop · Help · Account.
// (Filter reminder đã chuyển vào Device Detail nên tab Reminder cũ được thay bằng Tracking - record ritual + tổng hợp theo ngày.)
const TABS: {
  key: TabKey;
  Icon: (p: { size?: number; color: string }) => React.JSX.Element;
  label: string;
  screen: ScreenName;
}[] = [
  { key: 'device', Icon: IconDevice, label: 'Device', screen: 'device-list' },
  { key: 'tracking', Icon: IconTracking, label: 'Tracking', screen: 'progress' },
  { key: 'shop', Icon: IconShop, label: 'Shop', screen: 'shop' },
  { key: 'help', Icon: IconHelp, label: 'Help', screen: 'help' },
  { key: 'account', Icon: IconAccount, label: 'Account', screen: 'me' },
];

export default function BottomTabBar({ active, navigate, unread = 0 }: Props) {
  const C = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: C.border,
        backgroundColor: C.bg,
        paddingBottom: 20, // chừa home-indicator (router tối giản, không safe-area context)
        paddingTop: 10,
      }}
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const color = isActive ? C.ochre : C.muted;
        return (
          <Pressable
            key={t.key}
            onPress={() => navigate(t.screen)}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}
            hitSlop={6}
          >
            <View>
              <t.Icon size={21} color={color} />
              {t.key === 'account' && unread > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -12,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 4,
                    backgroundColor: BADGE_RED,
                    borderWidth: 1.5,
                    borderColor: C.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: '#fff', fontSize: 9, lineHeight: 12 }}>
                    {unread > 9 ? '9+' : String(unread)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 10, letterSpacing: 0.4, color }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
