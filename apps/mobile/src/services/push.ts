// Adapter FCM push cho app — Rev 2 (Option A): Tuya = SENDER. App chỉ lấy FCM token rồi đăng ký
// với TUYA (`registerDevice(token,'fcm')` — bridge TuyaMessage); Tuya đẩy banner qua cert FCM/APNs
// đã up console + tự lưu Message Center per-user. KHÔNG còn gọi backend /push/tokens.
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

/** Đăng ký token với Tuya cloud (map với user Tuya ĐANG LOGIN — SDK tự biết, không cần uid). */
async function registerWithTuya(token: string): Promise<void> {
  if (tuyaLib?.Tuya?.registerDevice == null) return; // bridge/native vắng → no-op
  await tuyaLib.Tuya.registerDevice(token, 'fcm');
}

/**
 * Đăng ký push cho phiên đăng nhập: xin quyền → lấy FCM token → registerDevice với Tuya.
 * Gọi SAU khi login Tuya thành công (Tuya map token với user hiện tại). No-op an toàn khi thiếu native.
 */
export async function syncPushToken(): Promise<void> {
  if (!pushAvailable) return;
  try {
    const granted = await requestPushPermission();
    if (!granted) return;
    const token = await getFcmToken();
    if (!token) return;
    await registerWithTuya(token);
  } catch (e) {
    devWarn('syncPushToken', e);
  }
}

/** Lắng nghe token đổi (onTokenRefresh) → đăng ký lại với Tuya. Trả hàm huỷ. */
export function listenTokenRefresh(): () => void {
  if (!pushAvailable) return () => {};
  try {
    return messagingLib().onTokenRefresh((token: string) => {
      registerWithTuya(token).catch((e) => devWarn('onTokenRefresh', e));
    });
  } catch (e) {
    devWarn('listenTokenRefresh', e);
    return () => {};
  }
}

/**
 * Gỡ push khi logout: xoá FCM token local (token cũ thành invalid → Tuya gửi sẽ fail và tự loại).
 * Bridge `unregisterDevice` phía Tuya đang là stub → deleteToken là đủ cho M1.
 */
export async function removePushToken(): Promise<void> {
  if (!pushAvailable) return;
  try {
    await messagingLib().deleteToken();
  } catch (e) {
    devWarn('removePushToken', e);
  }
}

// ---- Hiển thị + điều hướng khi tap ----
const ANDROID_CHANNEL_ID = 'default';

/**
 * Tạo notification channel SỚM lúc app boot (Android 8+ bắt buộc channel tồn tại — nếu chỉ tạo
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
