import { Platform } from 'react-native';
import { PUSH_API_KEY } from '../config/api';
import { registerPushToken, unregisterPushToken } from './api';

// Adapter push cho app. Đăng ký token với CẢ hai (provider là config phía backend, app không biết dùng cái nào):
//  - Tuya (SDK registerDevice): Android FCM token, iOS APNs token → Tuya cloud là sender.
//  - Backend (/push/tokens, api-key): FCM registration token (cả 2 nền tảng) → firebase-admin là sender khi
//    NOTIFICATION_PROVIDER=fcm. Chỉ đăng ký backend khi có PUSH_API_KEY (chưa cấu hình → bỏ, tránh 401 ở dev).
// require-guard @react-native-firebase/messaging + @notifee/react-native (import tĩnh chạm native
// lúc import → crash khi Metro chưa build native). Native vắng → no-op. Cùng pattern services/tuya.ts.

let messagingLib: any = null;
let notifeeLib: any = null;
let tuyaLib: any = null;
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
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  tuyaLib = require('@jimmy-vu/react-native-turbo-tuya');
} catch {
  tuyaLib = null;
}

/** true khi native FCM có mặt (đã build native). Dev/Metro chưa build → false → no-op. */
export const pushAvailable: boolean = messagingLib != null;

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

type TuyaPushProvider = 'fcm' | 'apns';
type TuyaPushToken = { token: string; provider: TuyaPushProvider };

async function getTuyaPushToken(): Promise<TuyaPushToken | null> {
  if (!pushAvailable) return null;
  try {
    const messaging = messagingLib();
    if (Platform.OS === 'ios') {
      if (typeof messaging.registerDeviceForRemoteMessages === 'function') {
        await messaging.registerDeviceForRemoteMessages();
      }
      const apnsToken =
        typeof messaging.getAPNSToken === 'function' ? await messaging.getAPNSToken() : null;
      return apnsToken ? { token: apnsToken, provider: 'apns' } : null;
    }
    const token = await getFcmToken();
    return token ? { token, provider: 'fcm' } : null;
  } catch (e) {
    devWarn('getTuyaPushToken', e);
    return null;
  }
}

/** Đăng ký token với Tuya cloud (map với user Tuya ĐANG LOGIN - SDK tự biết, không cần uid). */
async function registerWithTuya(token: string, provider: TuyaPushProvider): Promise<void> {
  if (tuyaLib?.Tuya?.registerDevice == null) return; // bridge/native vắng → no-op
  await tuyaLib.Tuya.registerDevice(token, provider);
}

// uid Tuya của phiên hiện tại - dùng để đăng-ký-lại backend khi token refresh (Android).
let currentUid: string | null = null;

/**
 * Đăng ký FCM registration token với BACKEND (firebase-admin sender). Dùng token của
 * getFcmToken() (KHÔNG phải APNs thô của Tuya) - firebase-admin gửi qua FCM, iOS bridge APNs.
 * Bỏ qua khi chưa cấu hình PUSH_API_KEY (dev).
 */
async function registerWithBackend(tuyaUid: string): Promise<void> {
  if (!PUSH_API_KEY) return;
  const fcm = await getFcmToken();
  if (!fcm) return;
  await registerPushToken(tuyaUid, fcm, Platform.OS === 'ios' ? 'ios' : 'android');
}

/**
 * Đăng ký push cho phiên đăng nhập: xin quyền → lấy token native → registerDevice với Tuya
 * + đăng ký FCM token với backend. Gọi SAU khi login Tuya thành công (kèm uid). No-op an toàn khi thiếu native.
 */
export async function syncPushToken(tuyaUid?: string): Promise<void> {
  if (!pushAvailable) return;
  try {
    const granted = await requestPushPermission();
    if (!granted) return;
    const pushToken = await getTuyaPushToken();
    if (!pushToken) return;
    await registerWithTuya(pushToken.token, pushToken.provider);
    if (tuyaUid) {
      currentUid = tuyaUid;
      try {
        await registerWithBackend(tuyaUid);
      } catch (e) {
        devWarn('registerWithBackend', e); // backend down KHÔNG được làm hỏng đường Tuya
      }
    }
  } catch (e) {
    devWarn('syncPushToken', e);
  }
}

/** Lắng nghe token đổi (onTokenRefresh) → đăng ký lại với Tuya. Trả hàm huỷ. */
export function listenTokenRefresh(): () => void {
  if (!pushAvailable) return () => {};
  if (Platform.OS === 'ios') return () => {};
  try {
    return messagingLib().onTokenRefresh((token: string) => {
      registerWithTuya(token, 'fcm').catch((e) => devWarn('onTokenRefresh', e));
      if (currentUid && PUSH_API_KEY) {
        registerPushToken(currentUid, token, 'android').catch((e) =>
          devWarn('onTokenRefreshBackend', e),
        );
      }
    });
  } catch (e) {
    devWarn('listenTokenRefresh', e);
    return () => {};
  }
}

/**
 * Gỡ push khi logout: Android xoá FCM token local; iOS clear APNs token trong Tuya SDK.
 */
export async function removePushToken(): Promise<void> {
  if (!pushAvailable) return;
  try {
    // Gỡ token FCM khỏi backend TRƯỚC (cần token hiện tại - deleteToken sẽ vô hiệu nó).
    if (PUSH_API_KEY) {
      try {
        const fcm = await getFcmToken();
        if (fcm) await unregisterPushToken(fcm);
      } catch (e) {
        devWarn('unregisterWithBackend', e);
      }
    }
    currentUid = null;
    if (Platform.OS === 'ios') {
      await tuyaLib?.Tuya?.unregisterDevice?.();
      return;
    }
    await messagingLib().deleteToken();
  } catch (e) {
    devWarn('removePushToken', e);
  }
}

// ---- Hiển thị + điều hướng khi tap ----
const ANDROID_CHANNEL_ID = 'default';

/**
 * Tạo notification channel SỚM lúc app boot (Android 8+ bắt buộc channel tồn tại - nếu chỉ tạo
 * lúc foreground-display thì noti đến khi app đang KILL có thể rơi vào channel không tồn tại).
 * Khớp meta-data default_notification_channel_id trong AndroidManifest.
 */
export async function ensureNotificationChannel(): Promise<void> {
  if (!notifeeLib) return;
  try {
    await notifeeLib.createChannel({ id: ANDROID_CHANNEL_ID, name: 'Default' });
  } catch (e) {
    devWarn('ensureNotificationChannel', e);
  }
}
type RemoteMessage = {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
};

/**
 * Điều hướng khi tap noti (thuần → test được). Tuya App Push KHÔNG cho custom data
 * → mặc định mở tab Notifications; vẫn tôn trọng data.screen nếu có (tương lai/nguồn khác).
 */
export type NotificationRoute = { screen: string; params?: Record<string, unknown> };
export function routeFromData(data?: Record<string, string>): NotificationRoute {
  if (!data || !data.screen) return { screen: 'notifications' };
  const params: Record<string, unknown> = {};
  if (data.devId) params.devId = data.devId;
  if (data.homeId) params.homeId = Number(data.homeId);
  return { screen: data.screen, params };
}

/** Hiển thị noti bằng Notifee (bắt buộc cho FOREGROUND; FCM không tự hiện khi app đang mở). */
export async function displayNotification(msg: RemoteMessage): Promise<void> {
  if (!notifeeLib) return;
  try {
    await notifeeLib.createChannel({ id: ANDROID_CHANNEL_ID, name: 'Default' });
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

/**
 * Noti tới khi app FOREGROUND → hiện bằng Notifee + báo `onReceive` để app refresh badge unread.
 * (Trước đây chỉ hiện Notifee → badge Account không nhảy khi nhận push lúc app mở - m1-fix-notifications #3.)
 * Trả hàm huỷ.
 */
export function onForegroundMessage(onReceive?: () => void): () => void {
  if (!pushAvailable) return () => {};
  try {
    return messagingLib().onMessage((msg: RemoteMessage) => {
      void displayNotification(msg);
      onReceive?.();
    });
  } catch (e) {
    devWarn('onForegroundMessage', e);
    return () => {};
  }
}

/** Tap noti khi app đang BACKGROUND → gọi cb với route (mặc định tab Notifications). Trả hàm huỷ. */
export function onNotificationTap(cb: (route: NotificationRoute) => void): () => void {
  if (!pushAvailable) return () => {};
  try {
    return messagingLib().onNotificationOpenedApp((msg: RemoteMessage) => {
      cb(routeFromData(msg?.data));
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
