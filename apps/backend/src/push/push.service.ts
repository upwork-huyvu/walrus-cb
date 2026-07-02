import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FIREBASE_MESSAGING,
  type FirebaseMessaging,
} from './firebase.provider';
import { PushTokensService } from './push-tokens.service';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>; // dùng cho tap-routing ở app (vd { screen, devId })
};

export type SendResult = {
  sent: number;
  failed: number;
  pruned: number;
  skipped?: boolean; // true khi FCM chưa cấu hình / user không có token
};

// Mã lỗi FCM cho token đã hết hiệu lực → cần prune khỏi DB.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Gửi push qua firebase-admin tới tất cả thiết bị của 1 Tuya uid; dọn token chết. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(FIREBASE_MESSAGING) private readonly messaging: FirebaseMessaging,
    private readonly tokens: PushTokensService,
  ) {}

  async sendToUid(tuyaUid: string, payload: PushPayload): Promise<SendResult> {
    if (!this.messaging) {
      this.logger.warn('FCM chưa cấu hình → bỏ qua gửi.');
      return { sent: 0, failed: 0, pruned: 0, skipped: true };
    }
    const tokens = await this.tokens.listTokensByUid(tuyaUid);
    if (tokens.length === 0) {
      return { sent: 0, failed: 0, pruned: 0, skipped: true };
    }

    const res = await this.messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });

    // Gom token chết → prune.
    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? '';
        if (DEAD_TOKEN_CODES.has(code)) dead.push(tokens[i]);
        else
          this.logger.warn(
            `Gửi lỗi (token #${i}): ${code} ${r.error?.message ?? ''}`,
          );
      }
    });
    await this.tokens.pruneTokens(dead);

    return {
      sent: res.successCount,
      failed: res.failureCount,
      pruned: dead.length,
    };
  }
}
