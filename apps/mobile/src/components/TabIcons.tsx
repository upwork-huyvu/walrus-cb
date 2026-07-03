import Svg, { Path, Circle, Polyline } from 'react-native-svg';

// Icon stroke cho bottom tab (SVG tint theo `color` — KHÔNG dùng glyph text/emoji vì Android
// render emoji màu, không tint được). Style feather-line 24x24, strokeWidth 1.8.
type IconProps = { size?: number; color: string };
const S = { fill: 'none' as const, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** Device — bông tuyết 6 cánh (ice bath). */
export function IconDevice({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2v20M4 6.5l16 11M20 6.5l-16 11" stroke={color} {...S} />
    </Svg>
  );
}

/** Reminder — đồng hồ. */
export function IconReminder({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} {...S} />
      <Polyline points="12 7 12 12 15.5 14" stroke={color} {...S} />
    </Svg>
  );
}

/** Shop — túi mua hàng. */
export function IconShop({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 8h12l-1.2 12.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3L6 8z" stroke={color} {...S} />
      <Path d="M9 10V6a3 3 0 0 1 6 0v4" stroke={color} {...S} />
    </Svg>
  );
}

/** Help — dấu hỏi trong vòng tròn. */
export function IconHelp({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={color} {...S} />
      <Path d="M9.3 9.2a2.8 2.8 0 0 1 5.4.9c0 1.8-2.7 2.4-2.7 3.6" stroke={color} {...S} />
      <Path d="M12 17h.01" stroke={color} {...S} />
    </Svg>
  );
}

/** Account — người. */
export function IconAccount({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={7.5} r={4} stroke={color} {...S} />
      <Path d="M4.5 20.5v-1a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5v1" stroke={color} {...S} />
    </Svg>
  );
}
