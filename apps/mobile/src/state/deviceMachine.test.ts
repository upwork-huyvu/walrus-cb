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

describe('deviceMachine — kết nối / loading / error (AC2, AC3)', () => {
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

  it('connectError → error + giữ message', () => {
    const s = deviceReducer(
      { ...initialDeviceState, status: 'connecting', loading: true },
      { type: 'connectError', error: 'đọc lỗi' },
    );
    expect(s.status).toBe('error');
    expect(s.loading).toBe(false);
    expect(s.error).toBe('đọc lỗi');
  });

  it('statusChanged đổi online↔offline; bỏ qua khi idle', () => {
    const online = deviceReducer({ ...initialDeviceState, status: 'offline' }, { type: 'statusChanged', isOnline: true });
    expect(online.status).toBe('online');
    const idle = deviceReducer({ ...initialDeviceState, status: 'idle' }, { type: 'statusChanged', isOnline: true });
    expect(idle.status).toBe('idle');
  });
});

describe('deviceMachine — realtime dpPatch (AC5)', () => {
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

describe('deviceMachine — optimistic reconcile target temp (AC4, AC5)', () => {
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

describe('deviceMachine — dpPatch diff (audit M-3) + ackTimeout message (audit H-1)', () => {
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

describe('deviceMachine — disconnect', () => {
  it('disconnect → idle + xoá nhiệt độ', () => {
    const s = deviceReducer(initialDeviceState, { type: 'disconnect' });
    expect(s.status).toBe('idle');
    expect(s.currentTemp).toBeNull();
    expect(s.targetTemp).toBeNull();
  });
});
