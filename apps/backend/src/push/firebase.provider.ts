import { Logger, type Provider } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { AppConfigService } from '../config/app-config.service';

// Token DI cho instance messaging của firebase-admin. Null khi thiếu service account (dev/chưa cấu hình)
// → PushService coi như no-op (không crash boot).
export const FIREBASE_MESSAGING = 'FIREBASE_MESSAGING';
export type FirebaseMessaging = Messaging | null;

const logger = new Logger('FirebaseProvider');

// Khởi tạo firebase-admin MỘT lần từ service account (env, server-only). private key trong env thường
// bị escape '\n' → un-escape trước khi dùng. Thiếu bất kỳ trường nào → trả null (push tắt, log cảnh báo).
export const firebaseMessagingProvider: Provider = {
  provide: FIREBASE_MESSAGING,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): FirebaseMessaging => {
    const projectId = config.get('FCM_PROJECT_ID');
    const clientEmail = config.get('FCM_CLIENT_EMAIL');
    const privateKeyRaw = config.get('FCM_PRIVATE_KEY');
    if (!projectId || !clientEmail || !privateKeyRaw) {
      logger.warn(
        'Thiếu FCM service account (FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY) → push FCM TẮT.',
      );
      return null;
    }
    // Chuẩn hoá private key: bỏ dấu nháy bao ngoài (Vercel env KHÔNG tự bỏ quote như dotenv ở local),
    // rồi un-escape '\n' → xuống dòng thật. Sai bước này → OpenSSL báo ERR_OSSL_UNSUPPORTED.
    let privateKey = privateKeyRaw.trim();
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    try {
      // Tránh init trùng khi hot-reload/test (getApps giữ app đã init).
      const app =
        getApps()[0] ??
        initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
      logger.log('firebase-admin đã init (FCM sẵn sàng).');
      return getMessaging(app);
    } catch (e) {
      // Key hỏng/không parse được → KHÔNG để sập cả backend (health/admin/mobile-auth vẫn phải chạy).
      // Tắt push, log rõ để sửa env FCM_PRIVATE_KEY (xuống dòng \n / dấu nháy).
      logger.error(
        `Init firebase-admin thất bại: ${(e as Error).message} → push FCM TẮT. Kiểm tra FCM_PRIVATE_KEY.`,
      );
      return null;
    }
  },
};
