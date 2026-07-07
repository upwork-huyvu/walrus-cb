import { BadRequestException, Injectable } from '@nestjs/common';
import { PushService } from '../../push/push.service';
import type {
  NotificationProvider,
  SendInput,
  SendOutcome,
} from './notification-provider';

/** Provider FCM — bọc PushService (firebase-admin gửi tới token đã đăng ký của mỗi uid). */
@Injectable()
export class FcmNotificationProvider implements NotificationProvider {
  readonly name = 'fcm' as const;

  constructor(private readonly push: PushService) {}

  async send(input: SendInput): Promise<SendOutcome> {
    const payload = { title: input.title, body: input.body };
    const r = input.all
      ? await this.push.sendToAll(payload)
      : await this.sendToUids(input.uids, payload);
    return {
      provider: this.name,
      total: r.total,
      success: r.success,
      failed: r.failed,
    };
  }

  private sendToUids(
    uids: string[] | undefined,
    payload: { title: string; body: string },
  ) {
    if (!uids || uids.length === 0) {
      throw new BadRequestException(
        'Cần chọn người nhận (uids) hoặc all=true.',
      );
    }
    return this.push.sendToUids(uids, payload);
  }
}
