// Bồn đá GIẢ LẬP có trạng thái RIÊNG theo từng devId (cho MOCK_DEVICES / native vắng):
// - mỗi devId 1 bản state (current/target/light/purify/freeze/online), seed từ MOCK_DEVICE_LIST;
// - setter đổi state + echo patch cho listener của ĐÚNG devId (giống dpUpdate thật → machine clear pending);
// - interval trôi nhiệt độ per-device: freeze bật → lạnh dần về target; tắt → ấm dần về AMBIENT.
import { DEFAULT_TEMP_RANGE } from './deviceSchema';
import { MOCK_DEVICE_LIST } from '../config/mock';
import type { DevicePatch, DeviceSnapshot, Subscription } from './tuya';

const AMBIENT = 20; // °C - nhiệt độ nước khi không làm lạnh
const TICK_MS = 3000;
const STEP = 0.5;

type MockState = {
  currentTemp: number;
  targetTemp: number;
  lightOn: boolean;
  purifyOn: boolean;
  freezeOn: boolean;
  isOnline: boolean;
};

// Fallback khi devId không có trong seed list (vd devId rỗng lúc chưa pair, hoặc id lạ).
const DEFAULT_SEED: MockState = {
  currentTemp: 12,
  targetTemp: 6,
  lightOn: false,
  purifyOn: false,
  freezeOn: true,
  isOnline: true,
};

const states = new Map<string, MockState>();
const listeners = new Map<string, Set<(p: DevicePatch) => void>>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

function seedFor(devId: string): MockState {
  const s = MOCK_DEVICE_LIST.find((d) => d.devId === devId);
  if (!s) return { ...DEFAULT_SEED };
  return {
    currentTemp: s.currentTemp,
    targetTemp: s.targetTemp,
    lightOn: s.lightOn,
    purifyOn: s.purifyOn,
    freezeOn: s.freezeOn,
    isOnline: s.isOnline,
  };
}

function getState(devId: string): MockState {
  let s = states.get(devId);
  if (!s) {
    s = seedFor(devId);
    states.set(devId, s);
  }
  return s;
}

function emit(devId: string, patch: DevicePatch): void {
  listeners.get(devId)?.forEach((fn) => fn(patch));
}

function tick(devId: string): void {
  const s = getState(devId);
  const goal = s.freezeOn ? s.targetTemp : AMBIENT;
  if (s.currentTemp === goal) return;
  const dir = goal > s.currentTemp ? 1 : -1;
  const next = s.currentTemp + dir * STEP;
  // Kẹp để không vượt goal (trôi 0.5° có thể nhảy qua).
  s.currentTemp = dir > 0 ? Math.min(next, goal) : Math.max(next, goal);
  emit(devId, { currentTemp: s.currentTemp });
}

function ensureTimer(devId: string): void {
  const hasListener = (listeners.get(devId)?.size ?? 0) > 0;
  if (hasListener && !timers.has(devId)) {
    timers.set(devId, setInterval(() => tick(devId), TICK_MS));
  } else if (!hasListener) {
    const t = timers.get(devId);
    if (t != null) {
      clearInterval(t);
      timers.delete(devId);
    }
  }
}

export function mockRead(devId: string): DeviceSnapshot {
  const s = getState(devId);
  return {
    currentTemp: s.currentTemp,
    targetTemp: s.targetTemp,
    lightOn: s.lightOn,
    purifyOn: s.purifyOn,
    freezeOn: s.freezeOn,
    isOnline: s.isOnline,
    tempRange: DEFAULT_TEMP_RANGE,
  };
}

export function mockSetTarget(devId: string, temp: number): void {
  getState(devId).targetTemp = temp;
  emit(devId, { targetTemp: temp }); // echo như thiết bị thật ack
}

export function mockSetLight(devId: string, on: boolean): void {
  getState(devId).lightOn = on;
  emit(devId, { lightOn: on });
}

export function mockSetPurify(devId: string, on: boolean): void {
  getState(devId).purifyOn = on;
  emit(devId, { purifyOn: on });
}

export function mockSetFreeze(devId: string, on: boolean): void {
  getState(devId).freezeOn = on;
  emit(devId, { freezeOn: on });
}

export function mockListen(devId: string, onPatch: (p: DevicePatch) => void): Subscription {
  let set = listeners.get(devId);
  if (!set) {
    set = new Set();
    listeners.set(devId, set);
  }
  set.add(onPatch);
  ensureTimer(devId);
  return {
    remove() {
      listeners.get(devId)?.delete(onPatch);
      ensureTimer(devId);
    },
  };
}
