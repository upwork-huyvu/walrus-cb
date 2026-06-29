import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Path as SvgPath } from 'react-native-svg';

// Smooth continuous ocean swells + rising water (port từ replit_generate/App.js).
type Props = {
  isActive: boolean;
  elapsed?: number;
  maxSeconds?: number;
  children?: ReactNode;
};

export default function WaterCircle({ isActive, elapsed, maxSeconds, children }: Props) {
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const frameRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const elapsedRef = useRef(elapsed ?? 0);
  const [svgData, setSvgData] = useState({ p1: '', p2: '', p3: '', fill: '' });

  const SIZE = 260;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 106;
  const PTS = 200;
  const MAX = maxSeconds ?? 180;

  useEffect(() => {
    elapsedRef.current = elapsed ?? 0;
  }, [elapsed]);

  const buildWave = (offset: number, amp: number, freq: number) => {
    let d = '';
    for (let i = 0; i <= PTS; i++) {
      const angle = (i / PTS) * 2 * Math.PI;
      const r = R + amp * Math.sin(freq * angle + offset);
      const x = (CX + r * Math.cos(angle - Math.PI / 2)).toFixed(2);
      const y = (CY + r * Math.sin(angle - Math.PI / 2)).toFixed(2);
      d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
    }
    return d + 'Z';
  };

  const buildFill = (ratio: number, waveOffset: number) => {
    const r = Math.max(0.01, Math.min(ratio, 1));
    const fillY = CY + R - r * R * 2;
    const pts = 8;
    const segW = (R * 2) / pts;
    const startX = CX - R;

    let d = `M${startX.toFixed(2)} ${(CY + R + 2).toFixed(2)}`;
    d += ` L${startX.toFixed(2)} ${fillY.toFixed(2)}`;

    for (let i = 0; i < pts; i++) {
      const x1 = startX + (i + 1) * segW;
      const cp1x = (startX + i * segW + segW / 3).toFixed(2);
      const cp2x = (x1 - segW / 3).toFixed(2);
      const cp1y = (fillY + 7 * Math.sin(((i + 0.33) / pts) * Math.PI * 3.5 + waveOffset)).toFixed(2);
      const cp2y = (fillY + 7 * Math.sin(((i + 0.66) / pts) * Math.PI * 3.5 + waveOffset)).toFixed(2);
      const endY = (fillY + 7 * Math.sin(((i + 1) / pts) * Math.PI * 3.5 + waveOffset)).toFixed(2);
      d += ` C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x1.toFixed(2)} ${endY}`;
    }

    d += ` L${(CX + R + 2).toFixed(2)} ${(CY + R + 2).toFixed(2)} Z`;
    return d;
  };

  const loop = () => {
    offsetRef.current += 0.01;
    const o = offsetRef.current;
    const ratio = Math.min(elapsedRef.current / MAX, 1);
    setSvgData({
      p1: buildWave(o, 20, 3),
      p2: buildWave(o * 0.6 + 1.05, 13, 5),
      p3: buildWave(o * 0.35 + 2.1, 7, 7),
      fill: buildFill(ratio, o * 3),
    });
    frameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (isActive) {
      Animated.timing(glowOpacity, { toValue: 1, duration: 1400, useNativeDriver: true }).start();
      if (!frameRef.current) frameRef.current = requestAnimationFrame(loop);
    } else {
      Animated.timing(glowOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }).start();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    }
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: SIZE, height: SIZE }}>
      <Animated.View style={{ position: 'absolute', opacity: glowOpacity }}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <ClipPath id="wclip">
              <Circle cx={CX} cy={CY} r={R - 2} />
            </ClipPath>
          </Defs>
          <SvgPath d={svgData.fill} fill="rgba(196,135,58,0.18)" clipPath="url(#wclip)" />
          <Circle cx={CX} cy={CY} r={R - 6} fill="rgba(196,135,58,0.04)" />
          <SvgPath d={svgData.p3} fill="none" stroke="#C4873A" strokeWidth="1" opacity="0.2" />
          <SvgPath d={svgData.p2} fill="none" stroke="#C4873A" strokeWidth="2" opacity="0.4" />
          <SvgPath d={svgData.p1} fill="none" stroke="#C4873A" strokeWidth="3" opacity="0.75" />
        </Svg>
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          borderWidth: 1,
          borderColor: 'rgba(196,135,58,0.2)',
          overflow: 'hidden',
        }}
      />
      <View
        style={{
          width: R * 2 - 8,
          height: R * 2 - 8,
          borderRadius: R,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        {children}
      </View>
    </View>
  );
}
