// Máy trạng thái thiết bị (reducer THUẦN - không gọi native, test được bằng jest).
// Gom: trạng thái kết nối (ConnStatus) + loading/error khi đọc snapshot + reconcile optimistic→ack cho target temp.
import { DEFAULT_TEMP_RANGE, clampToRange, type TempRange } from '../services/deviceSchema';

export type ConnStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'error';

/** Chức năng nào thiết bị THẬT có DP (để ẩn nút không tồn tại). Thiếu snapshot → coi như có (mock). */
export type DeviceCaps = { power: boolean; light: boolean; purify: boolean };

export type DeviceState = {
  status: ConnStatus;
  loading: boolean; // đang đọc snapshot
  error: string | null;
  currentTemp: number | null;
  targetTemp: number | null;
  powerOn: boolean; // nguồn (setting_pwr)
  lightOn: boolean;
  purifyOn: boolean; // lọc/khử trùng (setting_clr)
  freezeOn: boolean; // (giữ cho tương thích; thiết bị g0cv1c KHÔNG có DP này)
  caps: DeviceCaps; // DP nào thiết bị có → UI ẩn nút không có
  pendingTarget: number | null; // target đang chờ ack (optimistic chưa confirm)
  prevTarget: number | null; // target trước khi optimistic (để revert nếu timeout)
  tempRange: TempRange;
  /**
   * Số lần đọc snapshot THÀNH CÔNG. Không phải để hiển thị - đây là tín hiệu cho `useAppState` ĐĂNG KÝ
   * LẠI listener realtime sau mỗi lần connect thành công.
   * Vì sao cần (m1-fix-device-connect-error): iOS `registerDeviceListener` làm
   * `[ThingSmartDevice deviceWithDeviceId:]` rồi **return im lặng nếu nil**. Đăng ký lúc cache SDK còn
   * rỗng ⇒ listener CHẾT ⇒ đọc lại thành công rồi vẫn không nhận được DP realtime nào.
   */
  connectSeq: number;
};

const ALL_CAPS: DeviceCaps = { power: true, light: true, purify: true };

// Mặc định: coi như đã có thiết bị (mock) - giữ UX cũ của UI clone (online, 12°C/6°C).
export const initialDeviceState: DeviceState = {
  status: 'online',
  loading: false,
  error: null,
  currentTemp: 12,
  targetTemp: 6,
  powerOn: true,
  lightOn: false,
  purifyOn: false,
  freezeOn: true,
  caps: ALL_CAPS,
  pendingTarget: null,
  prevTarget: null,
  tempRange: DEFAULT_TEMP_RANGE,
  connectSeq: 0,
};

export type Snapshot = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean;
  purifyOn?: boolean; // optional: thiết bị thật có thể chưa expose
  freezeOn?: boolean;
  powerOn?: boolean;
  caps?: DeviceCaps; // thiếu → coi như có tất (mock/legacy)
  isOnline: boolean;
  tempRange: TempRange;
};

export type DpPatch = {
  currentTemp?: number | null;
  targetTemp?: number | null;
  powerOn?: boolean;
  lightOn?: boolean;
  purifyOn?: boolean;
  freezeOn?: boolean;
  isOnline?: boolean;
};

export type DeviceAction =
  | { type: 'connectStart' }
  | { type: 'connectOk'; snapshot: Snapshot }
  | { type: 'connectError'; error: string }
  | { type: 'statusChanged'; isOnline: boolean }
  | { type: 'dpPatch'; patch: DpPatch }
  | { type: 'setTargetOptimistic'; temp: number }
  | { type: 'ackResolved'; temp: number }
  | { type: 'ackTimeout'; temp: number; error?: string }
  | { type: 'disconnect' };

const ACK_TIMEOUT_MSG = 'Device didn’t confirm the temperature change';

export function deviceReducer(state: DeviceState, action: DeviceAction): DeviceState {
  switch (action.type) {
    case 'connectStart':
      return { ...state, status: 'connecting', loading: true, error: null };

    case 'connectOk': {
      const s = action.snapshot;
      return {
        ...state,
        status: s.isOnline ? 'online' : 'offline',
        loading: false,
        error: null,
        currentTemp: s.currentTemp,
        targetTemp: s.targetTemp,
        lightOn: s.lightOn,
        // Snapshot thiếu DP power/purify/freeze (thiết bị thật chưa expose) → default FALSE, KHÔNG kế
        // thừa giá trị của bồn mở trước đó (tránh rò state giữa các bồn).
        powerOn: s.powerOn ?? false,
        purifyOn: s.purifyOn ?? false,
        freezeOn: s.freezeOn ?? false,
        caps: s.caps ?? ALL_CAPS,
        tempRange: s.tempRange,
        pendingTarget: null,
        prevTarget: null,
        connectSeq: state.connectSeq + 1, // → useAppState đăng ký lại listener realtime trên instance sống
      };
    }

    case 'connectError':
      // XOÁ số liệu cũ: chưa đọc được snapshot thì gauge phải hiện `-`. Trước đây state giữ nguyên giá
      // trị đang có - mà mặc định là MOCK 12°/6° ⇒ màn lỗi vẫn khoe nhiệt độ như thật (m1-fix-device-connect-error).
      return {
        ...state,
        status: 'error',
        loading: false,
        error: action.error,
        currentTemp: null,
        targetTemp: null,
        pendingTarget: null,
        prevTarget: null,
      };

    case 'statusChanged': {
      // 'idle' = chưa kết nối; 'error' = đọc snapshot THẤT BẠI ⇒ chỉ mình `connectOk` được quyền đưa về
      // online. Lật pill bằng cờ online suông là nói dối: DP map vẫn rỗng nên điều khiển không hề ăn.
      if (state.status === 'idle' || state.status === 'error') return state;
      const next: ConnStatus = action.isOnline ? 'online' : 'offline';
      return next === state.status ? state : { ...state, status: next }; // không đổi → giữ nguyên ref
    }

    case 'dpPatch': {
      // Diff trước khi tạo state mới (audit M-3): không đổi gì → trả CÙNG ref → useReducer bỏ re-render.
      const p = action.patch;
      const next: DeviceState = { ...state };
      let changed = false;
      if (p.currentTemp !== undefined && p.currentTemp !== state.currentTemp) {
        next.currentTemp = p.currentTemp;
        changed = true;
      }
      if (p.powerOn !== undefined && p.powerOn !== state.powerOn) {
        next.powerOn = p.powerOn;
        changed = true;
      }
      if (p.lightOn !== undefined && p.lightOn !== state.lightOn) {
        next.lightOn = p.lightOn;
        changed = true;
      }
      if (p.purifyOn !== undefined && p.purifyOn !== state.purifyOn) {
        next.purifyOn = p.purifyOn;
        changed = true;
      }
      if (p.freezeOn !== undefined && p.freezeOn !== state.freezeOn) {
        next.freezeOn = p.freezeOn;
        changed = true;
      }
      if (p.targetTemp !== undefined && p.targetTemp !== null) {
        // Thiết bị là nguồn sự thật: echo target → set + xoá pending (đã confirm/đổi ngoài).
        if (p.targetTemp !== state.targetTemp || state.pendingTarget !== null) {
          next.targetTemp = p.targetTemp;
          next.pendingTarget = null;
          next.prevTarget = null;
          changed = true;
        }
      }
      // Cùng lý do với 'statusChanged': đang `error` thì KHÔNG tự lật sang online (useAppState sẽ đọc
      // lại snapshot thật khi realtime báo online - xem self-heal ở listener).
      if (p.isOnline !== undefined && state.status !== 'idle' && state.status !== 'error') {
        const ns: ConnStatus = p.isOnline ? 'online' : 'offline';
        if (ns !== state.status) {
          next.status = ns;
          changed = true;
        }
      }
      return changed ? next : state;
    }

    case 'setTargetOptimistic': {
      const clamped = clampToRange(action.temp, state.tempRange);
      return {
        ...state,
        targetTemp: clamped,
        pendingTarget: clamped,
        // giữ giá trị trước-khi-pending để revert; nếu đã pending thì giữ prevTarget gốc.
        prevTarget: state.pendingTarget === null ? state.targetTemp : state.prevTarget,
        error: null,
      };
    }

    case 'ackResolved':
      if (state.pendingTarget !== action.temp) return state; // ack cũ/không khớp → bỏ
      return { ...state, pendingTarget: null, prevTarget: null };

    case 'ackTimeout':
      if (state.pendingTarget !== action.temp) return state; // đã bị ghi đè → bỏ
      return {
        ...state,
        targetTemp: state.prevTarget,
        pendingTarget: null,
        prevTarget: null,
        error: action.error ?? ACK_TIMEOUT_MSG, // dùng message đã map (audit H-1) nếu có
      };

    case 'disconnect':
      return {
        ...state,
        status: 'idle',
        currentTemp: null,
        targetTemp: null,
        pendingTarget: null,
        prevTarget: null,
      };

    default:
      return state;
  }
}
