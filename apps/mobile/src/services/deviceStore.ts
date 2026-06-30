// Lưu devId đã pair (persist qua restart). AsyncStorage là native module → bọc try/catch:
// chưa link native (dev) → trả '' / no-op (không crash).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tuya.devId';

export async function getDevId(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function setDevId(devId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, devId);
  } catch {
    /* native chưa link → bỏ qua (state vẫn giữ trong phiên) */
  }
}

export async function clearDevId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
