import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import { setIntroSeen } from '../state/introFlag';

type Props = { navigate: Navigate };

// Intro first-launch (4 slide, theo design): video card (placeholder - video/ảnh client đưa sau)
// + badge + tiêu đề + mô tả; Next/Get started, Skip all. Xem xong ghi cờ → lần sau vào thẳng welcome.
const SLIDES = [
  {
    badge: 'INTRODUCTION',
    cardColor: '#1B2A4A',
    title: 'Welcome to Walrus',
    desc: 'Your complete cold therapy system - designed for serious practitioners and first-timers alike.',
  },
  {
    badge: 'GETTING STARTED',
    cardColor: '#143C36',
    title: 'Your First Plunge',
    desc: 'How to prepare, how long to stay in, and what to expect during and after your first session.',
  },
  {
    badge: 'SCIENCE',
    cardColor: '#2A1B3D',
    title: 'Cold Science',
    desc: 'The research behind cold exposure - how it affects your nervous system, recovery, and mood.',
  },
  {
    badge: 'SETUP',
    cardColor: '#16301F',
    title: 'Getting Connected',
    desc: 'Pair your Walrus device to control temperature remotely, set schedules, and track usage.',
  },
];

export default function IntroScreen({ navigate }: Props) {
  const C = useTheme();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;
  const last = index === SLIDES.length - 1;

  const finish = () => {
    void setIntroSeen(); // fire-and-forget - không chặn điều hướng
    // Intro hiện SAU lần đăng nhập đầu → đi tiếp vào app (home-gate → tự tạo "My Home" → Device List).
    navigate('home-gate');
  };

  const next = () => {
    if (last) return finish();
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top: dots (giữa) + Skip all (phải) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 16 }}>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 18,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i === index ? C.ochre : C.border,
                }}
              />
            ))}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Pressable onPress={finish} hitSlop={10}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>Skip all</Text>
            </Pressable>
          </View>
        </View>

        {/* Slides (swipe được; Next cũng trượt) */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1, marginTop: 18 }}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={{ width, paddingHorizontal: 24 }}>
              {/* Video card placeholder (video/ảnh sẽ gắn sau) */}
              <View
                style={{
                  backgroundColor: s.cardColor,
                  borderRadius: 20,
                  height: 300,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    borderWidth: 1,
                    borderColor: 'rgba(245,236,215,0.25)',
                    borderRadius: 20,
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 10, letterSpacing: 2 }}>
                    {s.badge}
                  </Text>
                </View>

                <View
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    borderWidth: 1.5,
                    borderColor: 'rgba(245,236,215,0.7)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: C.white, fontSize: 22, marginLeft: 4 }}>▶</Text>
                </View>

                <Text
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    fontFamily: F.body,
                    color: 'rgba(245,236,215,0.55)',
                    fontSize: 10,
                    letterSpacing: 3,
                  }}
                >
                  TAP TO PLAY
                </Text>
              </View>

              <Text
                style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginTop: 26 }}
              >
                {i + 1} OF {SLIDES.length}
              </Text>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginTop: 10 }}>
                {s.title}
              </Text>
              <Text
                style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginTop: 12 }}
              >
                {s.desc}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Nút chính */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
          <Pressable
            onPress={next}
            style={{
              backgroundColor: C.ochre,
              borderRadius: 26,
              paddingVertical: 17,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.3 }}>
              {last ? 'Get started →' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
