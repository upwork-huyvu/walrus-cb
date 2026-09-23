import {
  deviceReducer,
  initialDeviceState,
  type Snapshot,
} from './deviceMachine';
import { DEFAULT_TEMP_RANGE } from '../services/deviceSchema';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  currentTemp: 10,
  targetTemp: 5,
  lightOn: true,
  isOnline: true,
  tempRange: DEFAULT_TEMP_RANGE,
  ...over,
});

describe('deviceMachine - kết nối / loading / error (AC2, AC3)', () => {
  it('connectStart → connecting + loading', () => {
    const s = deviceReducer(initialDeviceState, { type: 'connectStart' });
    expect(s.status).toBe('connecting');
    expect(s.loading).toBe(true);
    expect(s.error).toBeNull();
  });

  it('connectOk(online) → online + nạp snapshot, hết loading', () => {
    const s = deviceReducer(
      { ...initialDeviceState, status: 'connecting', loading: true },
      { type: 'connectOk', snapshot: snap({ targetTemp: 7 }) },
    );
    expect(s.status).toBe('online');
    expect(s.loading).toBe(false);
    expect(s.targetTemp).toBe(7);
    expect(s.currentTemp).toBe(10);
  });

  it('connectOk(offline) → offline', () => {
    const s = deviceReducer(initialDeviceState, {
      type: 'connectOk',
      snapshot: snap({ isOnline: false }),
    });
    expect(s.status).toBe('offline');
  });

  it('connectOk: snapshot thiếu purify/freeze → FALSE, KHÔNG kế thừa state bồn trước (không rò state)', () => {
    // Bồn A trước đó bật purify+freeze; mở bồn B mà snapshot không có 2 DP đó.
    const prev = { ...initialDeviceState, purifyOn: true, freezeOn: true };
    const s = deviceReducer(prev, {
      type: 'connectOk',
      snapshot: snap(), // snap() không set purifyOn/freezeOn → undefined
    });
    expect(s.purifyOn).toBe(false);
    expect(s.freezeOn).toBe(false);
  });

  it('connectOk: nạp powerOn + caps (ẩn nút không có DP); thiếu caps → coi như có tất', () => {
    const s = deviceReducer(initialDeviceState, {
      type: 'connectOk',
      snapshot: snap({ powerOn: true, caps: { power: true, light: true, purify: false } }),
    });
    expect(s.powerOn).toBe(true);
    expect(s.caps).toEqual({ power: true, light: true, purify: false });
    // thiếu caps trong snapshot → ALL_CAPS (mock/legacy)
    const s2 = deviceReducer(initialDeviceState, { type: 'connectOk', snapshot: snap() });
    expect(s2.caps).toEqual({ power: true, light: true, purify: true });
    expect(s2.powerOn).toBe(false); // thiếu powerOn → false
  });

  it('dpPatch: powerOn cập nhật; không đổi → giữ ref', () => {
    const base = { ...initialDeviceState, powerOn: false };
    const on = deviceReducer(base, { type: 'dpPatch', patch: { powerOn: true } });
    expect(on.powerOn).toBe(true);
    const same = deviceReducer(on, { type: 'dpPatch', patch: { powerOn: true } });
    expect(same).toBe(on); // no-op → cùng ref
  });

  it('connectOk: snapshot CÓ purify/freeze → nạp đúng giá trị bồn hiện tại', () => {
    const s = deviceReducer(initialDeviceState, {
      type: 'connectOk',
      snapshot: snap({ purifyOn: true, freezeOn: false }),
    });
    expect(s.purifyOn).toBe(true);
    expect(s.freezeOn).toBe(false);
  });

  it('connectError → error + giữ message', () => {
    const s = deviceReducer(
      { ...initialDeviceState, status: 'connecting', loading: true },
      { type: 'connectError', error: 'đọc lỗi' },
    );
    expect(s.status).toBe('error');
    expect(s.loading).toBe(false);
    expect(s.error).toBe('đọc lỗi');
  });

  // Tín hiệu để useAppState đăng ký lại listener realtime (iOS registerDeviceListener im lặng bỏ qua
  // khi cache SDK chưa có thiết bị ⇒ listener đăng ký lúc lỗi là listener chết).
  it('connectOk tăng connectSeq mỗi lần đọc thành công', () => {
    const first = deviceReducer(initialDeviceState, { type: 'connectOk', snapshot: snap({}) });
    expect(first.connectSeq).toBe(initialDeviceState.connectSeq + 1);
    const second = deviceReducer(first, { type: 'connectOk', snapshot: snap({}) });
    expect(second.connectSeq).toBe(first.connectSeq + 1);
    // Lỗi thì KHÔNG tăng - không có listener mới nào cần đăng ký.
    expect(deviceReducer(first, { type: 'connectError', error: 'x' }).connectSeq).toBe(first.connectSeq);
  });

  // m1-fix-device-connect-error: đọc snapshot trượt thì KHÔNG được khoe số cũ - mặc định của state là
  // mock 12°/6°, khách nhìn màn ERROR mà vẫn thấy nhiệt độ "thật".
  it('connectError XOÁ nhiệt độ đang hiển thị (gauge về `-`)', () => {
    const s = deviceReducer(
      { ...initialDeviceState, status: 'connecting', loading: true, pendingTarget: 60, prevTarget: 50 },
      { type: 'connectError', error: 'no device' },
    );
    expect(s.currentTemp).toBeNull();
    expect(s.targetTemp).toBeNull();
    expect(s.pendingTarget).toBeNull();
    expect(s.prevTarget).toBeNull();
  });

  it('statusChanged đổi online↔offline; bỏ qua khi idle', () => {
    const online = deviceReducer({ ...initialDeviceState, status: 'offline' }, { type: 'statusChanged', isOnline: true });
    expect(online.status).toBe('online');
    const idle = deviceReducer({ ...initialDeviceState, status: 'idle' }, { type: 'statusChanged', isOnline: true });
    expect(idle.status).toBe('idle');
  });

  // Chỉ `connectOk` mới được đưa về online. Lật pill bằng cờ online suông = nói dối: `readDevice` chưa
  // thành công lần nào ⇒ DP map rỗng ⇒ publish bị từ chối ⇒ "online" nhưng bấm gì cũng không ăn.
  it('statusChanged KHÔNG lật error → online', () => {
    const s = deviceReducer(
      { ...initialDeviceState, status: 'error', error: 'no device' },
      { type: 'statusChanged', isOnline: true },
    );
    expect(s.status).toBe('error');
    expect(s.error).toBe('no device');
  });

  it('dpPatch KHÔNG lật error → online (vẫn nhận giá trị DP kèm theo)', () => {
    const s = deviceReducer(
      { ...initialDeviceState, status: 'error', error: 'no device', currentTemp: null },
      { type: 'dpPatch', patch: { currentTemp: 5, isOnline: true } },
    );
    expect(s.status).toBe('error');
    expect(s.currentTemp).toBe(5);
  });
});

describe('deviceMachine - realtime dpPatch (AC5)', () => {
  it('dpPatch cập nhật current/light + online từ event', () => {
    const s = deviceReducer(initialDeviceState, {
      type: 'dpPatch',
      patch: { currentTemp: 3, lightOn: false, isOnline: false },
    });
    expect(s.currentTemp).toBe(3);
    expect(s.lightOn).toBe(false);
    expect(s.status).toBe('offline');
  });

  it('echo targetTemp khớp pending → confirm (xoá pending)', () => {
    const pending = deviceReducer(initialDeviceState, { type: 'setTargetOptimistic', temp: 4 });
    expect(pending.pendingTarget).toBe(4);
    const confirmed = deviceReducer(pending, { type: 'dpPatch', patch: { targetTemp: 4 } });
    expect(confirmed.pendingTarget).toBeNull();
    expect(confirmed.targetTemp).toBe(4);
  });
});

describe('deviceMachine - optimistic reconcile target temp (AC4, AC5)', () => {
  it('setTargetOptimistic kẹp theo range + đặt pending + lưu prevTarget', () => {
    const s = deviceReducer({ ...initialDeviceState, targetTemp: 6 }, { type: 'setTargetOptimistic', temp: 999 });
    expect(s.targetTemp).toBe(DEFAULT_TEMP_RANGE.max); // 12 (kẹp)
    expect(s.pendingTarget).toBe(DEFAULT_TEMP_RANGE.max);
    expect(s.prevTarget).toBe(6);
  });

  it('ackResolved khớp pending → xoá pending (giữ giá trị mới)', () => {
    const pending = deviceReducer({ ...initialDeviceState, targetTemp: 6 }, { type: 'setTargetOptimistic', temp: 4 });
    const s = deviceReducer(pending, { type: 'ackResolved', temp: 4 });
    expect(s.pendingTarget).toBeNull();
    expect(s.targetTemp).toBe(4);
    expect(s.error).toBeNull();
  });

  it('ackTimeout khớp pending → revert về prevTarget + báo lỗi', () => {
    const pending = deviceReducer({ ...initialDeviceState, targetTemp: 6 }, { type: 'setTargetOptimistic', temp: 4 });
    const s = deviceReducer(pending, { type: 'ackTimeout', temp: 4 });
    expect(s.targetTemp).toBe(6); // revert
    expect(s.pendingTarget).toBeNull();
    expect(s.error).toBeTruthy();
  });

  it('ack cũ không khớp pending hiện tại → bỏ qua (không revert giá trị mới hơn)', () => {
    const p1 = deviceReducer({ ...initialDeviceState, targetTemp: 6 }, { type: 'setTargetOptimistic', temp: 4 });
    const p2 = deviceReducer(p1, { type: 'setTargetOptimistic', temp: 5 }); // bump tiếp → pending=5
    const s = deviceReducer(p2, { type: 'ackTimeout', temp: 4 }); // timeout của lệnh cũ
    expect(s.targetTemp).toBe(5); // giữ giá trị mới
    expect(s.pendingTarget).toBe(5);
  });
});

describe('deviceMachine - dpPatch diff (audit M-3) + ackTimeout message (audit H-1)', () => {
  it('dpPatch không đổi gì → trả CÙNG ref (bỏ re-render)', () => {
    const base = { ...initialDeviceState, currentTemp: 12, lightOn: false, status: 'online' as const };
    const same = deviceReducer(base, { type: 'dpPatch', patch: { currentTemp: 12, lightOn: false, isOnline: true } });
    expect(same).toBe(base); // tham chiếu y hệt
  });

  it('dpPatch có đổi → trả ref mới', () => {
    const base = { ...initialDeviceState, currentTemp: 12, status: 'online' as const };
    const next = deviceReducer(base, { type: 'dpPatch', patch: { currentTemp: 5 } });
    expect(next).not.toBe(base);
    expect(next.currentTemp).toBe(5);
  });

  it('ackTimeout dùng message đã map nếu được truyền', () => {
    const pending = deviceReducer({ ...initialDeviceState, targetTemp: 6 }, { type: 'setTargetOptimistic', temp: 4 });
    const s = deviceReducer(pending, { type: 'ackTimeout', temp: 4, error: 'Device is offline or unreachable.' });
    expect(s.error).toBe('Device is offline or unreachable.');
    expect(s.targetTemp).toBe(6);
  });
});

describe('deviceMachine - disconnect', () => {
  it('disconnect → idle + xoá nhiệt độ', () => {
    const s = deviceReducer(initialDeviceState, { type: 'disconnect' });
    expect(s.status).toBe('idle');
    expect(s.currentTemp).toBeNull();
    expect(s.targetTemp).toBeNull();
  });
});
