import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import type {
  NotificationProvider,
  SendInput,
  SendOutcome,
} from './notification-provider';

/** Provider Tuya App Push - bọc NotificationsService.sendAppPush (map title/body → template ${title}/${content}). */
@Injectable()
export class TuyaNotificationProvider implements NotificationProvider {
  readonly name = 'tuya' as const;

  constructor(private readonly notifications: NotificationsService) {}

  async send(input: SendInput): Promise<SendOutcome> {
    const r = await this.notifications.sendAppPush({
      title: input.title,
      body: input.body,
      uids: input.uids,
      all: input.all,
    });
    return {
      provider: this.name,
      total: r.total,
      success: r.success,
      failed: r.failed,
    };
  }
}
