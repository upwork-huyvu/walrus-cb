import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import RadarView from './RadarView';
import { blipFromBleScan, blipFromEzStep } from '../services/radarModel';
import type { Blip } from '../services/radarModel';
import type { BleScanItem } from '../services/pairing';

// Test component ĐẦU TIÊN của repo → dùng react-test-renderer (đã có sẵn trong devDeps),
// không thêm @testing-library để khỏi đụng dependency (scope: chỉ JS, không rebuild).
//
// ⚠️ Fake timers BẮT BUỘC: tia quét là `Animated.loop(...)` vô hạn với `useNativeDriver:false`
// (SVG không chạy được native driver) → với timer thật, `act()` chờ animation flush mãi không xong
// và jest TREO (không fail, không log - treo im). Fake timers cắt vòng đó.
jest.useFakeTimers();

const ble = (over: Partial<BleScanItem> = {}): BleScanItem => ({
  id: 'id-1',
  name: 'Walrus Ice Bath',
  productId: 'p1',
  uuid: 'uuid-1',
  mac: 'AA:BB',
  address: '',
  deviceType: 0,
  isCombo: true,
  ...over,
});

function render(blips: Blip[], onPressBlip = jest.fn()) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<RadarView blips={blips} onPressBlip={onPressBlip} />);
  });
  return { tree, onPressBlip };
}

/**
 * Lấy các nút blip theo testID + onPress.
 * ⚠️ KHÔNG dùng `findAllByType(Pressable)`: nó trả về RỖNG ở đây (react-test-renderer không khớp
 * được type của Pressable qua preset RN) → test "blip nằm trong khung" từng PASS RỖNG vì vòng lặp
 * không chạy lần nào. Lọc theo testID thì bám vào thứ component thật sự render ra.
 */
const blipButtons = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.props?.testID === 'string' &&
      n.props.testID.startsWith('blip-') &&
      typeof n.props?.onPress === 'function',
  );

describe('RadarView', () => {
  it('N blip → N phần tử chạm được (AC2: nhiều thiết bị hiện cùng lúc, không chỉ cái đầu tiên)', () => {
    const blips = [
      blipFromBleScan(ble({ uuid: 'u1' })),
      blipFromBleScan(ble({ uuid: 'u2' })),
      blipFromBleScan(ble({ uuid: 'u3' })),
    ];
    const { tree } = render(blips);
    expect(blipButtons(tree)).toHaveLength(3);
  });

  it('không có thiết bị nào → radar vẫn render, không blip nào', () => {
    const { tree } = render([]);
    expect(blipButtons(tree)).toHaveLength(0);
  });

  it('chạm blip → gọi callback với ĐÚNG blip đó (AC3)', () => {
    const b1 = blipFromBleScan(ble({ uuid: 'u1', name: 'Walrus A' }));
    const b2 = blipFromBleScan(ble({ uuid: 'u2', name: 'Walrus B' }));
    const { tree, onPressBlip } = render([b1, b2]);

    act(() => {
      tree.root.findByProps({ testID: 'blip-ble:u2' }).props.onPress();
    });

    expect(onPressBlip).toHaveBeenCalledTimes(1);
    expect(onPressBlip).toHaveBeenCalledWith(expect.objectContaining({ key: 'ble:u2' }));
  });

  it('blip đặt đúng chỗ theo (angle, radius) của model - và KHÔNG đổi giữa 2 lần render', () => {
    const blips = [blipFromBleScan(ble({ uuid: 'u1' }))];
    const { tree } = render(blips);
    const first = tree.root.findByProps({ testID: 'blip-ble:u1' }).props.style;

    const { tree: tree2 } = render(blips);
    const second = tree2.root.findByProps({ testID: 'blip-ble:u1' }).props.style;

    expect(second.left).toBe(first.left);
    expect(second.top).toBe(first.top);
  });

  it('blip nằm trong khung radar, không tràn ra ngoài', () => {
    const size = 260;
    const blips = Array.from({ length: 8 }, (_, i) => blipFromBleScan(ble({ uuid: `u${i}` })));
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<RadarView blips={blips} onPressBlip={jest.fn()} size={size} />);
    });

    for (const node of blipButtons(tree)) {
      const { left, top } = node.props.style;
      expect(left).toBeGreaterThanOrEqual(-22);
      expect(left).toBeLessThanOrEqual(size);
      expect(top).toBeGreaterThanOrEqual(-22);
      expect(top).toBeLessThanOrEqual(size);
    }
  });

  it('nguồn khác nhau → icon khác nhau (BLE vs Wi-Fi/EZ) để user phân biệt được', () => {
    const bleBlip = blipFromBleScan(ble({ uuid: 'u1' }));
    const ezBlip = blipFromEzStep({ step: 'device_find' })!;
    const { tree } = render([bleBlip, ezBlip]);

    const icon = (key: string) =>
      tree.root.findByProps({ testID: `blip-${key}` }).findAllByType('Text' as any)[0]?.props
        .children;

    expect(icon('ble:u1')).not.toBe(icon('ez:pending'));
  });

  it('accessibilityLabel = tên thiết bị (chạm được bằng screen reader)', () => {
    const { tree } = render([blipFromBleScan(ble({ uuid: 'u1', name: 'Walrus Ice Bath' }))]);
    expect(tree.root.findByProps({ testID: 'blip-ble:u1' }).props.accessibilityLabel).toBe(
      'Walrus Ice Bath',
    );
  });
});
