// Kiểu + tính toán cho reminder bảo trì thiết bị (m1-device-reminders).

const DAY_MS = 86_400_000;

/** Mức khẩn theo số ngày còn lại (khớp UI cũ: >21 ok · ≤21 warn · ≤7 soon · <0 overdue). */
export type ReminderStage = 'ok' | 'warn' | 'soon' | 'overdue';

/** Reminder trả về FE: field DB + countdown đã tính. */
export type ReminderView = {
  deviceId: string;
  type: string;
  intervalDays: number;
  lastReplacedAt: string; // ISO
  enabled: boolean;
  daysRemaining: number; // âm = quá hạn
  stage: ReminderStage;
};

/**
 * Tính số ngày còn lại + mức khẩn từ lastReplacedAt + intervalDays.
 * daysRemaining = intervalDays − floor((now − lastReplacedAt)/1 ngày). Thuần → test được.
 */
export function computeStage(
  intervalDays: number,
  lastReplacedAt: Date,
  now: number = Date.now(),
): { daysRemaining: number; stage: ReminderStage } {
  const elapsed = Math.floor((now - lastReplacedAt.getTime()) / DAY_MS);
  const daysRemaining = intervalDays - elapsed;
  let stage: ReminderStage;
  if (daysRemaining < 0) stage = 'overdue';
  else if (daysRemaining <= 7) stage = 'soon';
  else if (daysRemaining <= 21) stage = 'warn';
  else stage = 'ok';
  return { daysRemaining, stage };
}

/** Các mốc CẦN nhắc push (dùng ở cron scanDue - B6). 'ok' không nhắc. */
export const NOTIFY_STAGES: ReminderStage[] = ['warn', 'soon', 'overdue'];

/** 1 reminder tới mốc cần nhắc (kết quả scanDue → cron gửi push). */
export type DueReminder = {
  tuyaUid: string;
  deviceId: string;
  stage: ReminderStage;
  daysRemaining: number;
};
