import { useState, useEffect, useReducer, useRef } from 'react';
import { getStreakMultiplier } from './levels';
import {
  initSdk,
  readDevice,
  setTargetTemp as tuyaSetTargetTemp,
  setLight as tuyaSetLight,
  listenDevice,
} from '../services/tuya';
import { clampToRange } from '../services/deviceSchema';
import { describeTuyaError } from '../services/tuyaError';
import { debounce } from '../lib/debounce';
import { deviceReducer, initialDeviceState } from './deviceMachine';
import { getDevId, setDevId as persistDevId } from '../services/deviceStore';

// App state (port từ replit_generate/App.js). Phần device (temp/light/status) chạy qua reducer thuần
// `deviceMachine` (test được) + adapter `services/tuya` (mock fallback). `devId` lấy từ pairing
// (m1-mobile-pairing) + persist (deviceStore). Chữ ký return giữ tương thích để screens không vỡ.
export function useAppState() {
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [ritualPoints, setRitualPoints] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [completedBreathworks, setCompletedBreathworks] = useState(0);
  const [lastSessionPoints, setLastSessionPoints] = useState(0);

  // Device: reducer (status/loading/error/temp/light/pending/tempRange). devId = thiết bị đã pair (persist).
  const [device, dispatch] = useReducer(deviceReducer, initialDeviceState);
  const [devId, setDevId] = useState('');
  const deviceConnected = device.status !== 'idle';

  // Publish target được DEBOUNCE (audit M-1): bấm +/- nhanh chỉ gửi giá trị cuối. Tạo 1 lần.
  const publishTargetRef = useRef(
    debounce((id: string, temp: number) => {
      void tuyaSetTargetTemp(id, temp).then((res) => {
        if (res.ok) dispatch({ type: 'ackResolved', temp });
        else dispatch({ type: 'ackTimeout', temp, error: res.error });
      });
    }, 400),
  );
  useEffect(() => {
    const publisher = publishTargetRef.current;
    return () => publisher.cancel(); // dọn debounce khi unmount
  }, []);

  // Nạp devId đã pair lúc mở app.
  useEffect(() => {
    getDevId().then((id) => {
      if (id) setDevId(id);
    });
  }, []);

  const completeSession = (seconds: number) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newStreak = 1;
    if (lastDate === today) newStreak = streak;
    else if (lastDate === yesterday) newStreak = streak + 1;

    const multiplier = getStreakMultiplier(newStreak);
    const pointsEarned = Math.round(seconds * multiplier);

    setTotalSessions((s) => s + 1);
    setTotalMinutes((m) => m + Math.round(seconds / 60));
    setStreak(newStreak);
    setLastDate(today);
    setRitualPoints((p) => p + pointsEarned);
    setLastSessionPoints(pointsEarned);
  };

  // Kết nối: (id mới từ pairing → persist) + init SDK + đọc snapshot DP. connecting → online/offline/error.
  const connectDevice = async (id?: string) => {
    const useId = id ?? devId;
    if (id && id !== devId) {
      setDevId(id);
      void persistDevId(id);
    }
    dispatch({ type: 'connectStart' });
    await initSdk();
    try {
      const s = await readDevice(useId);
      dispatch({ type: 'connectOk', snapshot: s });
    } catch (e) {
      // Map mã lỗi Tuya → thông điệp phân biệt (audit H-1) thay vì chuỗi cố định.
      dispatch({ type: 'connectError', error: describeTuyaError(e).message });
    }
  };

  // Thử lại sau khi đọc lỗi (state error → connecting → đọc lại).
  const retry = () => {
    void connectDevice();
  };

  const disconnectDevice = () => {
    dispatch({ type: 'disconnect' });
  };

  // Optimistic UI + đẩy DP xuống thiết bị (no-op khi native vắng / chưa pair). Fail → revert đèn.
  const toggleLight = () => {
    const next = !device.lightOn;
    dispatch({ type: 'dpPatch', patch: { lightOn: next } });
    void tuyaSetLight(devId, next).then((res) => {
      if (!res.ok) dispatch({ type: 'dpPatch', patch: { lightOn: !next } });
    });
  };

  // Đặt target: kẹp theo schema → optimistic (pending) ngay → publish DEBOUNCE → confirm ack / revert nếu fail.
  const setTargetTemp = (temp: number) => {
    const clamped = clampToRange(temp, device.tempRange);
    dispatch({ type: 'setTargetOptimistic', temp: clamped });
    publishTargetRef.current(devId, clamped);
  };

  // Realtime DP + online/offline (onDeviceStatus) → reducer. No-op khi native vắng / chưa kết nối.
  useEffect(() => {
    if (!deviceConnected || !devId) return;
    const sub = listenDevice(devId, (p) => dispatch({ type: 'dpPatch', patch: p }));
    return () => sub.remove();
  }, [deviceConnected, devId]);

  const completeBreathwork = (rounds = 1) => {
    setCompletedBreathworks((b) => b + 1);
    const multiplier = getStreakMultiplier(streak);
    const points = Math.round(rounds * 10 * multiplier);
    setRitualPoints((p) => p + points);
  };

  return {
    totalSessions,
    totalMinutes,
    streak,
    ritualPoints,
    completeSession,
    lastSessionPoints,
    completedBreathworks,
    completeBreathwork,
    // device
    deviceConnected,
    devId,
    currentTemp: device.currentTemp,
    targetTemp: device.targetTemp,
    lightOn: device.lightOn,
    connStatus: device.status,
    deviceLoading: device.loading,
    deviceError: device.error,
    tempRange: device.tempRange,
    pendingTarget: device.pendingTarget,
    connectDevice,
    disconnectDevice,
    toggleLight,
    setTargetTemp,
    retry,
  };
}

// State được truyền xuống screens (kèm isDark do App bơm vào).
export type AppState = ReturnType<typeof useAppState> & { isDark: boolean };
