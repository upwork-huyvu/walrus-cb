import { useRef, useState } from 'react';
import { PanResponder, Text, View, type LayoutChangeEvent } from 'react-native';
import { F, useTheme } from '../theme';
import { fractionOfMinutes, minutesFromFraction } from '../lib/sessionTimer';

type Props = {
  value: number; // phút hiện tại
  onChange: (minutes: number) => void;
  min?: number;
  max?: number;
};

const THUMB = 26;
const TRACK_H = 6;

// Thanh trượt chọn thời lượng (phút) - pure JS (PanResponder), KHÔNG cần native slider.
// Kéo hoặc chạm trên track → snap về phút nguyên [min,max]. Ref-based để tránh stale-closure
// trong PanResponder (được tạo 1 lần nhưng phải đọc width/onChange mới nhất).
export default function DurationSlider({ value, onChange, min = 1, max = 10 }: Props) {
  const C = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  // Config mới nhất cho responder đọc (tránh bắt giá trị cũ ở lần tạo đầu).
  const cfg = useRef({ min, max, onChange });
  cfg.current = { min, max, onChange };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  // x (px trong track) → phút. Trừ nửa thumb mỗi bên để đầu/cuối chạm đúng min/max.
  const minutesFromX = (x: number): number => {
    const usable = widthRef.current - THUMB;
    if (usable <= 0) return cfg.current.min;
    const frac = (x - THUMB / 2) / usable;
    return minutesFromFraction(frac, cfg.current.min, cfg.current.max);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // giữ gesture khi đang kéo (đừng nhường ScrollView)
      onPanResponderGrant: (e) => cfg.current.onChange(minutesFromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => cfg.current.onChange(minutesFromX(e.nativeEvent.locationX)),
    }),
  ).current;

  const frac = fractionOfMinutes(value, min, max);
  const thumbLeft = Math.max(0, frac * Math.max(0, width - THUMB));
  const fillW = thumbLeft + THUMB / 2;

  return (
    <View style={{ width: '100%', paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 14 }}>
        <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 30 }}>
          {value}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14 }}> min</Text>
        </Text>
      </View>

      {/* Vùng chạm: cao 44 cho dễ kéo; track vẽ giữa. Các View trang trí đặt pointerEvents="none"
          để outer View LUÔN là touch target → locationX tương đối với track (không lệch khi chạm lên thumb). */}
      <View {...pan.panHandlers} onLayout={onLayout} style={{ height: 44, justifyContent: 'center' }}>
        <View pointerEvents="none" style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: C.border }} />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            width: fillW,
            height: TRACK_H,
            borderRadius: TRACK_H / 2,
            backgroundColor: C.ochre,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: thumbLeft,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: C.ochre,
            borderWidth: 3,
            borderColor: C.bg,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10 }}>{min} min</Text>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10 }}>{max} min</Text>
      </View>
    </View>
  );
}
