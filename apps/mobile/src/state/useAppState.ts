import { useState } from 'react';
import { getStreakMultiplier } from './levels';

// App state (port từ replit_generate/App.js). Phần device (temp/light) sẽ nối Tuya
// SDK ở B6 — đánh dấu "replaced by Tuya SDK later".
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

  // Simulate connection — replace with Tuya SDK call later
  const connectDevice = () => {
    setDeviceConnected(true);
    setCurrentTemp(12);
    setTargetTemp_(6);
    setLightOn(false);
  };

  const disconnectDevice = () => {
    setDeviceConnected(false);
    setCurrentTemp(null);
    setTargetTemp_(null);
  };

  const toggleLight = () => setLightOn((l) => !l);
  const setTargetTemp = (temp: number) =>
    setTargetTemp_(Math.max(-3, Math.min(12, temp)));

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
