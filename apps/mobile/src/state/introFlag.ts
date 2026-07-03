// Cờ "đã xem intro first-launch" (4 slide video). AsyncStorage là native module → try/catch:
// môi trường chưa link native → coi như CHƯA xem (an toàn: chỉ dư 1 lần intro, không crash).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'walrus.introSeen';

export async function getIntroSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    /* no-op — lần sau xem lại intro, không sao */
  }
}
