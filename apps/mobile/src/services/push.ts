// Adapter FCM push cho app. require-guard @react-native-firebase/messaging + @notifee/react-native
// (import tĩnh sẽ chạm native module lúc import → crash khi Metro chưa build native). Native vắng → no-op,
// để UI/dev chạy được. Cùng pattern services/tuya.ts.
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken, type Platform as ApiPlatform } from './api';

let messagingLib: any = null;
let notifeeLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  messagingLib = require('@react-native-firebase/messaging').default;
} catch {
  messagingLib = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  notifeeLib = require('@notifee/react-native').default;
} catch {
  notifeeLib = null;
}

/** true khi native FCM có mặt (đã build native). Dev/Metro chưa build → false → no-op. */
export const pushAvailable: boolean = messagingLib != null;

const platform: ApiPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

function devWarn(where: string, e: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[push] ${where} failed`, e);
  }
}

/** Xin quyền noti (iOS: FCM authorization; Android 13+: POST_NOTIFICATIONS qua Notifee). */
export async function requestPushPermission(): Promise<boolean> {
  if (!pushAvailable) return false;
  try {
    const status = await messagingLib().requestPermission();
    // 1=AUTHORIZED, 2=PROVISIONAL (đủ để nhận); 0=DENIED, -1=NOT_DETERMINED.
    const granted = status === 1 || status === 2;
    if (notifeeLib) await notifeeLib.requestPermission(); // Android 13+ POST_NOTIFICATIONS + kênh
    return granted;
  } catch (e) {
    devWarn('requestPermission', e);
    return false;
  }
}

export async function getFcmToken(): Promise<string | null> {
  if (!pushAvailable) return null;
  try {
    return await messagingLib().getToken();
  } catch (e) {
    devWarn('getToken', e);
    return null;
  }
}

/**
 * Đăng ký token cho user lúc login: xin quyền → lấy token → POST backend map với tuyaUid.
 * No-op an toàn khi native vắng / chưa cấp quyền / uid rỗng.
 */
export async function syncPushToken(tuyaUid: string): Promise<void> {
  if (!pushAvailable || !tuyaUid) return;
  try {
    const granted = await requestPushPermission();
    if (!granted) return;
    const token = await getFcmToken();
    if (!token) return;
    await registerPushToken(tuyaUid, token, platform);
  } catch (e) {
    devWarn('syncPushToken', e);
  }
}

/** Lắng nghe token đổi (onTokenRefresh) → cập nhật backend. Trả hàm huỷ. */
export function listenTokenRefresh(tuyaUid: string): () => void {
  if (!pushAvailable || !tuyaUid) return () => {};
  try {
    return messagingLib().onTokenRefresh((token: string) => {
      registerPushToken(tuyaUid, token, platform).catch((e) => devWarn('onTokenRefresh', e));
    });
  } catch (e) {
    devWarn('listenTokenRefresh', e);
    return () => {};
  }
}

/** Gỡ token khi logout: xoá khỏi backend + xoá token FCM local (best-effort). */
export async function removePushToken(): Promise<void> {
  if (!pushAvailable) return;
  try {
    const token = await getFcmToken();
    if (token) await unregisterPushToken(token);
    await messagingLib().deleteToken();
  } catch (e) {
    devWarn('removePushToken', e);
  }
}

// ---- Hiển thị + điều hướng khi tap (B7) ----
const ANDROID_CHANNEL_ID = 'default';
type RemoteMessage = {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
};

/** Điều hướng suy ra từ data của noti (thuần → test được). data.screen (+ devId) do server đặt. */
export type NotificationRoute = { screen: string; params?: Record<string, unknown> };
export function routeFromData(data?: Record<string, string>): NotificationRoute | null {
  if (!data || !data.screen) return null;
  const params: Record<string, unknown> = {};
  if (data.devId) params.devId = data.devId;
  if (data.homeId) params.homeId = Number(data.homeId);
  return { screen: data.screen, params };
}

/** Hiển thị noti bằng Notifee (bắt buộc cho FOREGROUND; FCM không tự hiện khi app đang mở). */
export async function displayNotification(msg: RemoteMessage): Promise<void> {
  if (!notifeeLib) return;
  try {
    await notifeeLib.createChannel({ id: ANDROID_CHANNEL_ID, name: 'Mặc định' });
    await notifeeLib.displayNotification({
      title: msg.notification?.title ?? '',
      body: msg.notification?.body ?? '',
      data: msg.data,
      android: { channelId: ANDROID_CHANNEL_ID, pressAction: { id: 'default' } },
    });
  } catch (e) {
    devWarn('displayNotification', e);
  }
}

/** Noti tới khi app FOREGROUND → hiện bằng Notifee. Trả hàm huỷ. */
export function onForegroundMessage(): () => void {
  if (!pushAvailable) return () => {};
  try {
    return messagingLib().onMessage((msg: RemoteMessage) => void displayNotification(msg));
  } catch (e) {
    devWarn('onForegroundMessage', e);
    return () => {};
  }
}

/** Tap noti khi app đang BACKGROUND → gọi cb với route. Trả hàm huỷ. */
export function onNotificationTap(cb: (route: NotificationRoute) => void): () => void {
  if (!pushAvailable) return () => {};
  try {
    return messagingLib().onNotificationOpenedApp((msg: RemoteMessage) => {
      const route = routeFromData(msg?.data);
      if (route) cb(route);
    });
  } catch (e) {
    devWarn('onNotificationTap', e);
    return () => {};
  }
}

/** Noti mở app từ trạng thái QUIT (getInitialNotification) → route ban đầu hoặc null. */
export async function getInitialRoute(): Promise<NotificationRoute | null> {
  if (!pushAvailable) return null;
  try {
    const msg = await messagingLib().getInitialNotification();
    return msg ? routeFromData(msg.data) : null;
  } catch (e) {
    devWarn('getInitialRoute', e);
    return null;
  }
}
