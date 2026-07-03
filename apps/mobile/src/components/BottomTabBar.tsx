import { Pressable, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate, ScreenName } from '../navigation';
import { IconDevice, IconReminder, IconShop, IconHelp, IconAccount } from './TabIcons';

export type TabKey = 'device' | 'reminder' | 'shop' | 'help' | 'account';

type Props = { active: TabKey; navigate: Navigate };

// Bottom tab 5 mục (map từ menu Maintenance của design): Device · Reminder · Shop · Help · Account.
const TABS: {
  key: TabKey;
  Icon: (p: { size?: number; color: string }) => React.JSX.Element;
  label: string;
  screen: ScreenName;
}[] = [
  { key: 'device', Icon: IconDevice, label: 'Device', screen: 'device-list' },
  { key: 'reminder', Icon: IconReminder, label: 'Reminder', screen: 'reminder' },
  { key: 'shop', Icon: IconShop, label: 'Shop', screen: 'shop' },
  { key: 'help', Icon: IconHelp, label: 'Help', screen: 'help' },
  { key: 'account', Icon: IconAccount, label: 'Account', screen: 'me' },
];

export default function BottomTabBar({ active, navigate }: Props) {
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
            onPress={() => !isActive && navigate(t.screen)}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}
            hitSlop={6}
          >
            <t.Icon size={21} color={color} />
            <Text style={{ fontFamily: F.body, fontSize: 10, letterSpacing: 0.4, color }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
