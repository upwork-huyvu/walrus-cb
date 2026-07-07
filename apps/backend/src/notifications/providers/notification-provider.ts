// Trừu tượng hoá kênh gửi thông báo → admin gửi 1 kiểu, backend route theo NOTIFICATION_PROVIDER.
export type ProviderName = 'tuya' | 'fcm';

/** Input gửi free-form: title + body, tới danh sách uid HOẶC tất cả. */
export type SendInput = {
  title: string;
  body: string;
  uids?: string[];
  all?: boolean;
  imageUrl?: string; // (fcm) ảnh hiển thị trong notification - Tuya template bỏ qua
  data?: Record<string, string>; // (fcm) deeplink / custom data (tap-routing) - Tuya template bỏ qua
};

/** Kết quả gửi (khớp shape UI admin) + provider đã dùng. */
export type SendOutcome = {
  provider: ProviderName;
  total: number;
  success: number;
  failed: number;
  deliveredUids?: string[]; // (fcm) uid THẬT SỰ nhận được → router log lịch sử đúng người
};

export interface NotificationProvider {
  readonly name: ProviderName;
  send(input: SendInput): Promise<SendOutcome>;
}

/** DI token cho router chọn provider theo ENV. */
export const TUYA_PROVIDER = 'TUYA_NOTIFICATION_PROVIDER';
export const FCM_PROVIDER = 'FCM_NOTIFICATION_PROVIDER';
