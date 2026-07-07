import { useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import type { AppState } from '../state/useAppState';

type Props = { navigate: Navigate; state: AppState };

// TAB Help - FAQ theo design (câu hỏi accordion: mở = ochre + ⌄, đóng = trắng + ›; section CAPS).
// Nội dung: copy client cung cấp (4 nhóm) + card "Still need help?" → email support.
const SUPPORT_EMAIL = 'support@walruswellness.com';

type QA = { q: string; a: string };
type Section = { title: string; items: QA[] };

const FAQ: Section[] = [
  {
    title: 'GETTING STARTED',
    items: [
      {
        q: 'How often should I use the ice bath?',
        a: 'Most practitioners benefit from 3–5 sessions per week. Beginners should start with 2–3 sessions and build up. Daily use is safe for most healthy adults.',
      },
      {
        q: 'What temperature is recommended?',
        a: 'Between 4°C and 15°C (39–59°F). Beginners often start around 12–15°C and gradually lower over time. The Walrus default is 10°C.',
      },
      {
        q: 'How long should each session be?',
        a: "Start with 1–2 minutes. Most experienced users aim for 3–5 minutes. Longer isn't necessarily better - consistent shorter sessions outperform occasional long ones.",
      },
      {
        q: 'Is cold water therapy safe for everyone?',
        a: "Cold exposure is contraindicated for people with certain heart conditions, Raynaud's disease, or cold urticaria. Always consult your doctor if you have any cardiovascular conditions before starting.",
      },
    ],
  },
  {
    title: 'CLEANING & MAINTENANCE',
    items: [
      {
        q: 'How do I clean my Walrus Ice Bath?',
        a: 'Use the Clean Cycle button in the app, or the button on the device. Run a cycle weekly or whenever the water appears cloudy. Use Walrus-approved cleaning tablets only.',
      },
      {
        q: 'How often should I replace the filter?',
        a: 'Every 90 days under normal use, or sooner if you notice reduced water clarity. The app tracks days since your last filter change and sends a reminder at 7 days remaining.',
      },
      {
        q: 'Why is my water cloudy?',
        a: "Cloudy water usually indicates the filter needs replacing or it's time for a cleaning cycle. Run the clean cycle and monitor - if it persists after 24 hours, replace the filter.",
      },
      {
        q: 'Where can I buy replacement filters?',
        a: 'Order directly from the Walrus Wellness shop at walruswellness.com/shop. Use genuine Walrus filters - third-party filters can damage the pump and void your warranty.',
      },
    ],
  },
  {
    title: 'DEVICE & CONNECTIVITY',
    items: [
      {
        q: "My device won't connect - what do I do?",
        a: 'Ensure your phone and the Walrus device are on the same Wi-Fi network (2.4GHz). Try restarting the device by holding the power button for 5 seconds. If problems persist, use "Reconnect" in the app.',
      },
      {
        q: 'Can I use the app without the device connected?',
        a: 'Yes. The app works independently - you can track sessions, browse content, and manage settings without a live device connection.',
      },
      {
        q: 'Does Walrus work on 5GHz Wi-Fi?',
        a: 'No - the Walrus device uses 2.4GHz Wi-Fi only. If your router broadcasts both bands with the same SSID, you may need to separate them in your router settings.',
      },
      {
        q: 'How do I update my device firmware?',
        a: "Firmware updates are pushed automatically when your device is online and idle. You'll see a notification in the app when an update is available. Never unplug the device during an update.",
      },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Account in the app settings. Tap "Change password" to update your credentials. If you signed in with Google or Apple, password management is handled by those providers.',
      },
      {
        q: 'How do I sign out?',
        a: 'Go to Account in the app settings and tap "Sign out". Your session history and device pairings will be preserved for when you sign back in.',
      },
      {
        q: 'Can I use my account on multiple devices?',
        a: 'Yes. Sign in with the same credentials on any device. Your session history, device pairings, and settings sync automatically.',
      },
    ],
  },
];

export default function HelpScreen({ state }: Props) {
  const C = useTheme();
  const [open, setOpen] = useState<string | null>(FAQ[0].items[0].q); // câu đầu mở sẵn như design

  const emailSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      /* không có mail app - bỏ qua */
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>
            MAINTENANCE & HELP
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28, lineHeight: 36, marginBottom: 18 }}>
            Frequently Asked{'\n'}Questions
          </Text>

          {FAQ.map((section) => (
            <View key={section.title} style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontFamily: F.body,
                  color: C.muted,
                  fontSize: 11,
                  letterSpacing: 2,
                  marginTop: 14,
                  marginBottom: 4,
                }}
              >
                {section.title}
              </Text>
              {section.items.map((item) => {
                const isOpen = open === item.q;
                return (
                  <View key={item.q} style={{ borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Pressable
                      onPress={() => setOpen(isOpen ? null : item.q)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 16,
                        gap: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: F.body,
                          color: isOpen ? C.ochre : C.white,
                          fontSize: 15,
                          flex: 1,
                          lineHeight: 21,
                        }}
                      >
                        {item.q}
                      </Text>
                      <Text style={{ color: C.muted, fontSize: 13 }}>{isOpen ? '⌄' : '›'}</Text>
                    </Pressable>
                    {isOpen ? (
                      <Text
                        style={{
                          fontFamily: F.body,
                          color: C.muted,
                          fontSize: 13,
                          lineHeight: 21,
                          paddingBottom: 18,
                        }}
                      >
                        {item.a}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Still need help? → email support */}
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 18,
              padding: 20,
              marginTop: 22,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 17, marginBottom: 6 }}>
              Still need help?
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 16 }}>
              Our team usually replies within one business day.
            </Text>
            <Pressable
              onPress={emailSupport}
              style={{ backgroundColor: C.ochre, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 14 }}>Email support</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
