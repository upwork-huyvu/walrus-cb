// Radar quét thiết bị (SVG) - vòng đồng tâm + tia quét xoay + blip chạm được.
// Thiết bị tìm thấy hiện thành ICON TRÊN MẶT SÓNG (đúng UX Smart Life "Searching for nearby
// devices…"), chạm vào blip → mở popup xác nhận ở màn cha.
//
// Vị trí blip do `radarModel.blipPosition()` quyết định (hash tất định) - KHÔNG tính ở đây, vì
// component re-render liên tục theo event scan; tính vị trí trong render = blip nhảy loạn.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { F, useTheme } from '../theme';
import type { Blip } from '../services/radarModel';

type Props = {
  blips: Blip[];
  onPressBlip: (blip: Blip) => void;
  size?: number;
  /** Tia quét chỉ xoay khi đang quét; dừng lại lúc đã pair xong/lỗi. */
  sweeping?: boolean;
};

const AnimatedG = Animated.createAnimatedComponent(G);

/** Toạ độ pixel của blip từ (angle, radius) chuẩn hoá. y xuống theo hệ toạ độ màn hình. */
function blipXY(blip: Blip, cx: number, cy: number, maxR: number) {
  const rad = (blip.angle * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * blip.radius * maxR,
    y: cy + Math.sin(rad) * blip.radius * maxR,
  };
}

export default function RadarView({ blips, onPressBlip, size = 260, sweeping = true }: Props) {
  const C = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 12; // chừa mép cho icon blip khỏi bị cắt

  useEffect(() => {
    if (!sweeping) {
      spin.stopAnimation();
      return undefined;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        // Tia quét là <G> của react-native-svg - KHÔNG chạy được native driver.
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweeping, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Hình quạt 60° cho tia quét, gốc ở tâm.
  const sweepPath = (() => {
    const r = maxR;
    const a0 = -Math.PI / 6;
    const a1 = Math.PI / 6;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
  })();

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="sweepFade" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={C.ochre} stopOpacity={0.42} />
            <Stop offset="100%" stopColor={C.ochre} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Vòng đồng tâm */}
        {[0.34, 0.62, 1].map((f) => (
          <Circle
            key={f}
            cx={cx}
            cy={cy}
            r={maxR * f}
            stroke={C.border}
            strokeWidth={1}
            fill="none"
          />
        ))}
        <Circle cx={cx} cy={cy} r={3} fill={C.ochre} />

        {/* Tia quét */}
        {sweeping && (
          <AnimatedG
            // @ts-expect-error - react-native-svg nhận string transform qua Animated, type chưa phủ.
            style={{ transform: [{ rotate }] }}
            originX={cx}
            originY={cy}
          >
            <Path d={sweepPath} fill="url(#sweepFade)" />
          </AnimatedG>
        )}
      </Svg>

      {/* Blip nằm ngoài <Svg> để dùng Pressable thật của RN (vùng chạm đáng tin hơn SVG onPress). */}
      {blips.map((blip) => {
        const { x, y } = blipXY(blip, cx, cy, maxR);
        return (
          <Pressable
            key={blip.key}
            testID={`blip-${blip.key}`}
            accessibilityRole="button"
            accessibilityLabel={blip.label}
            onPress={() => onPressBlip(blip)}
            hitSlop={10}
            style={{
              position: 'absolute',
              left: x - 22,
              top: y - 22,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: C.ochre,
              backgroundColor: C.bg,
            }}
          >
            {/* Nguồn phát hiện khác nhau → icon khác nhau (AC5): BLE chạm được, Wi-Fi/EZ chỉ hiển thị. */}
            <Text style={{ fontSize: 18 }}>{blip.source === 'ble' ? '🛁' : '📶'}</Text>
          </Pressable>
        );
      })}

      {/* Nhãn tên thiết bị đặt dưới blip - tách khỏi Pressable để không nới rộng vùng chạm. */}
      {blips.map((blip) => {
        const { x, y } = blipXY(blip, cx, cy, maxR);
        return (
          <Text
            key={`label-${blip.key}`}
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: x - 55,
              top: y + 24,
              width: 110,
              textAlign: 'center',
              fontFamily: F.body,
              fontSize: 10,
              color: C.muted,
            }}
          >
            {blip.label}
          </Text>
        );
      })}
    </View>
  );
}
