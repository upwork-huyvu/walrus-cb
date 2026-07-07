// Icon SVG cho màn device detail (đèn / lọc / làm lạnh / vệ sinh) - outline mảnh theo brand.
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

type IconProps = { size?: number; color: string };

/** Đèn (bulb outline). */
export function BulbIcon({ size = 26, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 0 0-3.7 10.7c.6.5 1 1.2 1.1 2l.1.8h5l.1-.8c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Line x1={9.8} y1={19.4} x2={14.2} y2={19.4} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={10.6} y1={21.4} x2={13.4} y2={21.4} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Lá (purify/ozone). */
export function LeafIcon({ size = 26, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.5 4.5C11 4.5 6 8.5 6 14c0 3 2 5 4.8 5 6 0 9.2-6 8.7-14.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M5 20.5c3.2-5.8 7.3-9.4 12-11.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Bông tuyết (freeze/chiller) - 6 nan hoa. */
export function SnowIcon({ size = 26, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[0, 60, 120].map((deg) => (
        <G key={deg} rotation={deg} origin="12, 12">
          <Line x1={12} y1={2.8} x2={12} y2={21.2} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M9.6 5.4 12 7.6l2.4-2.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.6 18.6 12 16.4l2.4 2.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ))}
      <Circle cx={12} cy={12} r={1.4} fill={color} />
    </Svg>
  );
}

/** Bồn tắm (ice bath) - cho device list item. */
export function BathIcon({ size = 26, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* vòi */}
      <Path d="M6 11V7a2 2 0 0 1 2-2h1.4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={9.4} y1={4.2} x2={9.4} y2={5.8} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* thân bồn */}
      <Path
        d="M3 11.4h18v1.4a4.2 4.2 0 0 1-4.2 4.2H7.2A4.2 4.2 0 0 1 3 12.8v-1.4Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* chân */}
      <Line x1={6.8} y1={17.2} x2={6.8} y2={19.2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={17.2} y1={17.2} x2={17.2} y2={19.2} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Mũi tên xoay (chu kỳ vệ sinh). */
export function RefreshIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 12a8 8 0 1 1-2.4-5.7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path d="M20.2 3.6v4.2H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
