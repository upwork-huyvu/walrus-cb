// Vòng cung nhiệt độ (SVG) cho màn device detail: track tối + cung vàng theo nhiệt hiện tại
// + vạch trắng ở đầu cung; giữa là số CURRENT + target. Cung 270°, mở đáy (135° → 405°).
import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { F, useTheme } from '../theme';
import type { TempRange } from '../services/deviceSchema';

// Dải hiển thị của gauge: từ min schema tới nhiệt độ nước thường (20°C) - thuần thị giác.
const VISUAL_MAX = 20;

const rad = (deg: number) => ((deg - 0) * Math.PI) / 180;
const point = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos(rad(deg)),
  y: cy + r * Math.sin(rad(deg)),
});

// Path cung tròn theo chiều kim đồng hồ từ startDeg → endDeg (hệ toạ độ màn hình, y xuống).
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = point(cx, cy, r, startDeg);
  const e = point(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

type Props = {
  current: number | null;
  target: number | null;
  pending?: boolean; // target đang chờ thiết bị ack → mờ nhẹ
  range: TempRange;
  size?: number;
};

const START = 135; // đáy-trái
const SWEEP = 270;

export default function TempGauge({ current, target, pending = false, range, size = 300 }: Props) {
  const C = useTheme();
  const stroke = 16;
  const r = (size - stroke) / 2 - 6; // chừa mép cho vạch trắng nhô ra
  const cx = size / 2;
  const cy = size / 2;

  const lo = range.min;
  const hi = Math.max(VISUAL_MAX, lo + 1);
  const frac =
    current == null ? 0 : Math.min(1, Math.max(0, (current - lo) / (hi - lo)));
  const endDeg = START + SWEEP * frac;
  const tickIn = point(cx, cy, r - stroke / 2 - 5, endDeg);
  const tickOut = point(cx, cy, r + stroke / 2 + 5, endDeg);

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        {/* track */}
        <Path
          d={arcPath(cx, cy, r, START, START + SWEEP)}
          stroke="rgba(245,236,215,0.08)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        {/* progress */}
        {frac > 0.005 && (
          <Path
            d={arcPath(cx, cy, r, START, endDeg)}
            stroke={C.ochre}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {/* vạch đầu cung */}
        {current != null && (
          <Line
            x1={tickIn.x}
            y1={tickIn.y}
            x2={tickOut.x}
            y2={tickOut.y}
            stroke={C.white}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </Svg>

      {/* Nội dung giữa gauge */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 4 }}>
          CURRENT
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 84, lineHeight: 96 }}>
            {current == null ? '-' : Math.round(current)}
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 30, marginTop: 14 }}>
            °
          </Text>
        </View>
        <Text style={{ fontFamily: F.body, fontSize: 15, opacity: pending ? 0.6 : 1 }}>
          <Text style={{ color: C.muted }}>Target </Text>
          <Text style={{ color: C.ochre }}>{target == null ? '-' : `${target}°C`}</Text>
        </Text>
      </View>
    </View>
  );
}
