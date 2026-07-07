import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
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
  ) {}

  /** Provider đang bật theo config (default 'tuya'). */
  activeProvider(): ProviderName {
    return this.config.get('NOTIFICATION_PROVIDER') === 'fcm' ? 'fcm' : 'tuya';
  }

  private provider(): NotificationProvider {
    return this.activeProvider() === 'fcm' ? this.fcm : this.tuya;
  }

  send(input: SendInput): Promise<SendOutcome> {
    const p = this.provider();
    this.logger.log(
      `Gửi thông báo qua provider=${p.name} (${input.all ? 'ALL' : `${input.uids?.length ?? 0} uid`})`,
    );
    return p.send(input);
  }
}
