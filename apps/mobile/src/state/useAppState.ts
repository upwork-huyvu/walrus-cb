import { useState, useEffect, useReducer, useRef, useCallback } from 'react';
import { getStreakMultiplier } from './levels';
import {
  initSdk,
  setTargetTemp as tuyaSetTargetTemp,
  setLight as tuyaSetLight,
  setPurify as tuyaSetPurify,
  setFreeze as tuyaSetFreeze,
  setPower as tuyaSetPower,
  listenDevice,
  refreshDevicesOnline,
} from '../services/tuya';
import { clampToRange } from '../services/deviceSchema';
import { readDeviceWithWarmup } from '../services/deviceConnect';
import { describeTuyaError } from '../services/tuyaError';
import { debounce } from '../lib/debounce';
import { deviceReducer, initialDeviceState } from './deviceMachine';
import { clearDevId, getDevId, setDevId as persistDevId } from '../services/deviceStore';
import {
  loadRitual,
  saveRitual,
  toISODate,
  totalMinutesOf,
  type SessionRecord,
} from '../services/ritualStore';

/** Khoảng cách tối thiểu giữa 2 lần tự đọc lại snapshot khi đang `error` (self-heal từ realtime). */
const RECONNECT_THROTTLE_MS = 5000;

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
  const devIdRef = useRef(devId);
  devIdRef.current = devId;
  const deviceConnected = device.status !== 'idle';
  // Listener realtime sống lâu hơn 1 lần render → đọc status qua ref cho khỏi dính giá trị cũ.
  const statusRef = useRef(device.status);
  statusRef.current = device.status;
  const healAtRef = useRef(0); // lần tự-đọc-lại gần nhất (chống quay vòng)

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
  // homeIdRef: nhớ home đang mở để `readDeviceWithWarmup` nạp được home data (cache thiết bị của SDK) khi
  // lần đọc đầu trượt - và để `retry()` sau đó vẫn warm được dù không ai truyền lại homeId.
  const connectReqRef = useRef('');
  const homeIdRef = useRef<number | undefined>(undefined);
  const connectDevice = async (id?: string, homeId?: number) => {
    const useId = id ?? devId;
    if (homeId != null) homeIdRef.current = homeId;
    connectReqRef.current = useId;
    if (id && id !== devId) {
      setDevId(id);
      void persistDevId(id);
    }
    dispatch({ type: 'connectStart' });
    await initSdk();
    try {
      // Không đọc trần nữa: lỗi transient (hay gặp nhất là `no_device` khi cache SDK chưa có bồn vừa
      // pair) → nạp home data + backoff rồi đọc lại. Xem services/deviceConnect.ts.
      const s = await readDeviceWithWarmup(useId, homeIdRef.current);
      if (connectReqRef.current !== useId) return; // đã có connect mới hơn → bỏ snapshot cũ
      dispatch({ type: 'connectOk', snapshot: s });
    } catch (e) {
      if (connectReqRef.current !== useId) return;
      // Map mã lỗi Tuya → thông điệp phân biệt (audit H-1) thay vì chuỗi cố định.
      dispatch({ type: 'connectError', error: describeTuyaError(e).message });
    }
  };
  // Giữ bản MỚI NHẤT của connectDevice cho các callback sống lâu (listener realtime) gọi lại, khỏi dính
  // closure cũ của lần render đầu.
  const connectDeviceRef = useRef(connectDevice);
  connectDeviceRef.current = connectDevice;

  // Thử lại sau khi đọc lỗi (state error → connecting → đọc lại).
  const retry = () => {
    void connectDevice();
  };

  // Làm mới CHỈ trạng thái online (không đọc lại cả snapshot ⇒ không nháy 'connecting', không nặng).
  // Vì sao cần: HomeScreen chỉ HIỂN THỊ connStatus, không tự connect. connStatus chỉ được set khi mở
  // Dashboard, nên Home dễ kẹt ở giá trị cũ (offline) trong khi máy đang online. Đọc lại bằng
  // isDeviceOnline - ĐÚNG nguồn Dashboard đọc - rồi patch qua statusChanged để Home khớp thật.
  const refreshOnline = async () => {
    if (!devId) return;
    const online = await refreshDevicesOnline([devId]);
    if (devId in online) dispatch({ type: 'statusChanged', isOnline: online[devId] });
  };

  const disconnectDevice = () => {
    dispatch({ type: 'disconnect' });
  };

  /**
   * Quên hẳn thiết bị sau khi Tuya đã remove thành công (hoặc nhận event remove từ home khác).
   * Khác disconnect: huỷ request/publish đang chờ và xoá cả devId persist để restart không nối lại bồn cũ.
   */
  const forgetDevice = useCallback(async (removedDevId: string): Promise<void> => {
    if (!removedDevId || devIdRef.current !== removedDevId) return;
    connectReqRef.current = '';
    publishTargetRef.current.cancel();
    devIdRef.current = '';
    setDevId('');
    dispatch({ type: 'disconnect' });
    await clearDevId();
  }, []);

  // Optimistic UI + đẩy DP xuống thiết bị (no-op khi native vắng / chưa pair). Fail → revert.
  const togglePower = () => {
    const next = !device.powerOn;
    dispatch({ type: 'dpPatch', patch: { powerOn: next } });
    void tuyaSetPower(devId, next).then((res) => {
      if (!res.ok) dispatch({ type: 'dpPatch', patch: { powerOn: !next } });
    });
  };

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
  //
  // Tự chữa khi đang `error`: thiết bị báo online → ĐỌC LẠI SNAPSHOT THẬT, chứ KHÔNG lật pill sang
  // online suông. Lý do (m1-fix-device-connect-error): `readDevice` chưa thành công lần nào ⇒ DP map
  // rỗng ⇒ mọi publish bị từ chối ⇒ pill xanh nhưng bấm gì cũng không ăn - đúng hiện tượng khách báo
  // là "đợi tý lại kết nối được".
  useEffect(() => {
    if (!deviceConnected || !devId) return;
    const sub = listenDevice(devId, (p) => {
      if (statusRef.current === 'error' && p.isOnline) {
        const now = Date.now();
        // Throttle: bồn có thể đẩy event liên tục, đọc lại mà vẫn lỗi thì đừng quay vòng.
        if (now - healAtRef.current >= RECONNECT_THROTTLE_MS) {
          healAtRef.current = now;
          void connectDeviceRef.current(devIdRef.current);
        }
        return; // bỏ patch này: connectOk sắp ghi đè toàn bộ state bằng số liệu thật
      }
      dispatch({ type: 'dpPatch', patch: p });
    });
    return () => sub.remove();
    // `connectSeq` (tăng ở mỗi connectOk) nằm trong deps để ĐĂNG KÝ LẠI listener sau khi đọc thành công:
    // iOS `registerDeviceListener` return im lặng khi cache SDK chưa có thiết bị ⇒ lần đăng ký lúc đang
    // lỗi là listener CHẾT, không đăng ký lại thì realtime im luôn dù đã kết nối được.
  }, [deviceConnected, devId, device.connectSeq]);

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
    powerOn: device.powerOn,
    lightOn: device.lightOn,
    purifyOn: device.purifyOn,
    freezeOn: device.freezeOn,
    caps: device.caps,
    connStatus: device.status,
    deviceLoading: device.loading,
    deviceError: device.error,
    tempRange: device.tempRange,
    pendingTarget: device.pendingTarget,
    connectDevice,
    disconnectDevice,
    forgetDevice,
    refreshOnline,
    togglePower,
    toggleLight,
    togglePurify,
    toggleFreeze,
    setTargetTemp,
    retry,
  };
}

// State được truyền xuống screens (kèm isDark do App bơm vào).
export type AppState = ReturnType<typeof useAppState> & { isDark: boolean };
