// Máy trạng thái thiết bị (reducer THUẦN — không gọi native, test được bằng jest).
// Gom: trạng thái kết nối (ConnStatus) + loading/error khi đọc snapshot + reconcile optimistic→ack cho target temp.
import { DEFAULT_TEMP_RANGE, clampToRange, type TempRange } from '../services/deviceSchema';

export type ConnStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'error';

export type DeviceState = {
  status: ConnStatus;
  loading: boolean; // đang đọc snapshot
  error: string | null;
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean;
  pendingTarget: number | null; // target đang chờ ack (optimistic chưa confirm)
  prevTarget: number | null; // target trước khi optimistic (để revert nếu timeout)
  tempRange: TempRange;
};

// Mặc định: coi như đã có thiết bị (mock) — giữ UX cũ của UI clone (online, 12°C/6°C).
export const initialDeviceState: DeviceState = {
  status: 'online',
  loading: false,
  error: null,
  currentTemp: 12,
  targetTemp: 6,
  lightOn: false,
  pendingTarget: null,
  prevTarget: null,
  tempRange: DEFAULT_TEMP_RANGE,
};

export type Snapshot = {
  currentTemp: number | null;
  targetTemp: number | null;
  lightOn: boolean;
  isOnline: boolean;
  tempRange: TempRange;
};

export type DpPatch = {
  currentTemp?: number | null;
  targetTemp?: number | null;
  lightOn?: boolean;
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

const ACK_TIMEOUT_MSG = 'Thiết bị không xác nhận lệnh đặt nhiệt độ';

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
        tempRange: s.tempRange,
        pendingTarget: null,
        prevTarget: null,
      };
    }

    case 'connectError':
      return { ...state, status: 'error', loading: false, error: action.error };

    case 'statusChanged':
      if (state.status === 'idle') return state; // chưa kết nối → bỏ qua
      return { ...state, status: action.isOnline ? 'online' : 'offline' };

    case 'dpPatch': {
      // Diff trước khi tạo state mới (audit M-3): không đổi gì → trả CÙNG ref → useReducer bỏ re-render.
      const p = action.patch;
      const next: DeviceState = { ...state };
      let changed = false;
      if (p.currentTemp !== undefined && p.currentTemp !== state.currentTemp) {
        next.currentTemp = p.currentTemp;
        changed = true;
      }
      if (p.lightOn !== undefined && p.lightOn !== state.lightOn) {
        next.lightOn = p.lightOn;
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
      if (p.isOnline !== undefined && state.status !== 'idle') {
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
