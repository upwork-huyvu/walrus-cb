import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { NotificationLogService } from '../notification-log.service';
import { TuyaNotificationProvider } from './tuya.provider';
import { FcmNotificationProvider } from './fcm.provider';
import type {
  NotificationProvider,
  ProviderName,
  SendInput,
  SendOutcome,
} from './notification-provider';

/**
 * Router chọn provider gửi thông báo theo ENV `NOTIFICATION_PROVIDER` (tuya | fcm, default tuya).
 * Admin gọi 1 chỗ (/notifications/send) → router quyết đường gửi.
 */
@Injectable()
export class NotificationRouterService {
  private readonly logger = new Logger(NotificationRouterService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly tuya: TuyaNotificationProvider,
    private readonly fcm: FcmNotificationProvider,
    private readonly log: NotificationLogService,
  ) {}

  /** Provider đang bật theo config (default 'tuya'). */
  activeProvider(): ProviderName {
    return this.config.get('NOTIFICATION_PROVIDER') === 'fcm' ? 'fcm' : 'tuya';
  }

  private provider(): NotificationProvider {
    return this.activeProvider() === 'fcm' ? this.fcm : this.tuya;
  }

  async send(input: SendInput): Promise<SendOutcome> {
    const p = this.provider();
    this.logger.log(
      `Gửi thông báo qua provider=${p.name} (${input.all ? 'ALL' : `${input.uids?.length ?? 0} uid`})`,
    );
    const outcome = await p.send(input);
    // Ghi lịch sử CHỈ khi FCM (tuya đã vào Tuya Message Center → app đọc thẳng, tránh trùng) và CHỈ cho
    // uid THẬT SỰ nhận được (deliveredUids) → không ghi noti trượt (không token). Best-effort: lỗi ghi
    // log KHÔNG được làm hỏng send đã hoàn tất (tránh admin retry gửi trùng / cron gửi lại spam).
    if (p.name === 'fcm' && outcome.deliveredUids?.length) {
      try {
        await this.log.record(outcome.deliveredUids, {
          title: input.title,
          body: input.body,
          provider: p.name,
        });
      } catch (e) {
        this.logger.warn(
          `Ghi lịch sử thông báo lỗi (đã gửi xong): ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return outcome;
  }
}
