import { useState, useEffect, useReducer, useRef } from 'react';
import { getStreakMultiplier } from './levels';
import {
  initSdk,
  readDevice,
  setTargetTemp as tuyaSetTargetTemp,
  setLight as tuyaSetLight,
  setPurify as tuyaSetPurify,
  setFreeze as tuyaSetFreeze,
  listenDevice,
} from '../services/tuya';
import { clampToRange } from '../services/deviceSchema';
import { describeTuyaError } from '../services/tuyaError';
import { debounce } from '../lib/debounce';
import { deviceReducer, initialDeviceState } from './deviceMachine';
import { getDevId, setDevId as persistDevId } from '../services/deviceStore';
import {
  loadRitual,
  saveRitual,
  toISODate,
  totalMinutesOf,
  type SessionRecord,
} from '../services/ritualStore';

// App state (port từ replit_generate/App.js). Phần device (temp/light/status) chạy qua reducer thuần
// `deviceMachine` (test được) + adapter `services/tuya` (mock fallback). `devId` lấy từ pairing
// (m1-mobile-pairing) + persist (deviceStore). Chữ ký return giữ tương thích để screens không vỡ.
export function useAppState() {
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [ritualPoints, setRitualPoints] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [lastSessionPoints, setLastSessionPoints] = useState(0);
  const [sessions, setSessions] = useState<SessionRecord[]>([]); // log per-session (persist)

  // Nạp ritual đã lưu lúc mở app (persist qua restart - trước đây in-memory nên mất).
  useEffect(() => {
    void loadRitual().then((d) => {
      setSessions(d.sessions);
      setTotalSessions(d.sessions.length);
      setTotalMinutes(totalMinutesOf(d));
      setStreak(d.streak);
      setRitualPoints(d.ritualPoints);
      setLastDate(d.lastDate);
    });
  }, []);

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
    const today = toISODate();
    const yesterday = toISODate(new Date(Date.now() - 86400000));
    let newStreak = 1;
    if (lastDate === today) newStreak = streak;
    else if (lastDate === yesterday) newStreak = streak + 1;

    const multiplier = getStreakMultiplier(newStreak);
    const pointsEarned = Math.round(seconds * multiplier);

    const record: SessionRecord = { date: today, seconds, points: pointsEarned, ts: Date.now() };
    const newSessions = [...sessions, record];
    const newPoints = ritualPoints + pointsEarned;

    setSessions(newSessions);
    setTotalSessions(newSessions.length);
    setTotalMinutes(Math.round(newSessions.reduce((a, s) => a + s.seconds, 0) / 60));
    setStreak(newStreak);
    setLastDate(today);
    setRitualPoints(newPoints);
    setLastSessionPoints(pointsEarned);

    void saveRitual({
      sessions: newSessions,
      ritualPoints: newPoints,
      streak: newStreak,
      lastDate: today,
    });
  };

  // Kết nối: (id mới từ pairing → persist) + init SDK + đọc snapshot DP. connecting → online/offline/error.
  // connectReqRef: chống ghi đè out-of-order - read native có thể về trễ/không đúng thứ tự khi đổi bồn nhanh;
  // chỉ nhận kết quả của lần connect MỚI NHẤT.
  const connectReqRef = useRef('');
  const connectDevice = async (id?: string) => {
    const useId = id ?? devId;
    connectReqRef.current = useId;
    if (id && id !== devId) {
      setDevId(id);
      void persistDevId(id);
    }
    dispatch({ type: 'connectStart' });
    await initSdk();
    try {
      const s = await readDevice(useId);
      if (connectReqRef.current !== useId) return; // đã có connect mới hơn → bỏ snapshot cũ
      dispatch({ type: 'connectOk', snapshot: s });
    } catch (e) {
      if (connectReqRef.current !== useId) return;
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

  const togglePurify = () => {
    const next = !device.purifyOn;
    dispatch({ type: 'dpPatch', patch: { purifyOn: next } });
    void tuyaSetPurify(devId, next).then((res) => {
      if (!res.ok) dispatch({ type: 'dpPatch', patch: { purifyOn: !next } });
    });
  };

  const toggleFreeze = () => {
    const next = !device.freezeOn;
    dispatch({ type: 'dpPatch', patch: { freezeOn: next } });
    void tuyaSetFreeze(devId, next).then((res) => {
      if (!res.ok) dispatch({ type: 'dpPatch', patch: { freezeOn: !next } });
    });
  };

  // Đặt target: kẹp theo schema → optimistic (pending) ngay → publish DEBOUNCE → confirm ack / revert nếu fail.
  const setTargetTemp = (temp: number) => {
    const clamped = clampToRange(temp, device.tempRange);
    dispatch({ type: 'setTargetOptimistic', temp: clamped });
    publishTargetRef.current(devId, clamped);
  };

  // Realtime DP + online/offline (onDeviceStatus) → reducer. Chỉ subscribe khi CÓ devId thật:
  // devId rỗng (chưa mở bồn nào) mà vẫn gọi thì mock tạo timer 'bồn ma' key '' chạy nền + bịa nhiệt độ.
  useEffect(() => {
    if (!deviceConnected || !devId) return;
    const sub = listenDevice(devId, (p) => dispatch({ type: 'dpPatch', patch: p }));
    return () => sub.remove();
  }, [deviceConnected, devId]);

  return {
    totalSessions,
    totalMinutes,
    streak,
    ritualPoints,
    completeSession,
    lastSessionPoints,
    sessions,
    // device
    deviceConnected,
    devId,
    currentTemp: device.currentTemp,
    targetTemp: device.targetTemp,
    lightOn: device.lightOn,
    purifyOn: device.purifyOn,
    freezeOn: device.freezeOn,
    connStatus: device.status,
    deviceLoading: device.loading,
    deviceError: device.error,
    tempRange: device.tempRange,
    pendingTarget: device.pendingTarget,
    connectDevice,
    disconnectDevice,
    toggleLight,
    togglePurify,
    toggleFreeze,
    setTargetTemp,
    retry,
  };
}

// State được truyền xuống screens (kèm isDark do App bơm vào).
export type AppState = ReturnType<typeof useAppState> & { isDark: boolean };
