import { useState, useEffect } from 'react';
import { getStreakMultiplier } from './levels';
import {
  initSdk,
  readDevice,
  setTargetTemp as tuyaSetTargetTemp,
  setLight as tuyaSetLight,
  listenDevice,
} from '../services/tuya';

// devId của bồn — TODO: lấy từ pairing (feature m1-mobile-pairing) / lưu local.
// B6 để rỗng → adapter Tuya tự dùng mock (UI clone chạy được khi chưa build native / chưa pair).
const DEVICE_ID = '';

// App state (port từ replit_generate/App.js). Phần device (temp/light) nối Tuya SDK qua
// services/tuya (adapter có mock fallback). Chữ ký return giữ nguyên để screens không phải sửa.
export function useAppState() {
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [ritualPoints, setRitualPoints] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [completedBreathworks, setCompletedBreathworks] = useState(0);
  const [lastSessionPoints, setLastSessionPoints] = useState(0);

  // Device state — replaced by Tuya SDK later
  const [deviceConnected, setDeviceConnected] = useState(true);
  const [currentTemp, setCurrentTemp] = useState<number | null>(12);
  const [targetTemp, setTargetTemp_] = useState<number | null>(6);
  const [lightOn, setLightOn] = useState(false);

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

  // Kết nối: init SDK + đọc snapshot DP thiết bị (adapter trả mock khi native vắng / devId rỗng).
  const connectDevice = async () => {
    setDeviceConnected(true);
    await initSdk();
    const s = await readDevice(DEVICE_ID);
    setCurrentTemp(s.currentTemp);
    setTargetTemp_(s.targetTemp);
    setLightOn(s.lightOn);
  };

  const disconnectDevice = () => {
    setDeviceConnected(false);
    setCurrentTemp(null);
    setTargetTemp_(null);
  };

  // Optimistic UI + đẩy DP xuống thiết bị (no-op khi native vắng).
  const toggleLight = () =>
    setLightOn((l) => {
      const next = !l;
      void tuyaSetLight(DEVICE_ID, next);
      return next;
    });

  const setTargetTemp = (temp: number) => {
    const v = Math.max(-3, Math.min(12, temp));
    setTargetTemp_(v);
    void tuyaSetTargetTemp(DEVICE_ID, v);
  };

  // Realtime DP (onDeviceStatus) → cập nhật currentTemp/targetTemp/lightOn. No-op khi native vắng.
  useEffect(() => {
    if (!deviceConnected) return;
    const sub = listenDevice(DEVICE_ID, (p) => {
      if (p.currentTemp !== undefined) setCurrentTemp(p.currentTemp);
      if (p.targetTemp !== undefined) setTargetTemp_(p.targetTemp);
      if (p.lightOn !== undefined) setLightOn(p.lightOn);
    });
    return () => sub.remove();
  }, [deviceConnected]);

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
    deviceConnected,
    currentTemp,
    targetTemp,
    lightOn,
    connectDevice,
    disconnectDevice,
    toggleLight,
    setTargetTemp,
  };
}

// State được truyền xuống screens (kèm isDark do App bơm vào).
export type AppState = ReturnType<typeof useAppState> & { isDark: boolean };
