import { Injectable, Logger } from '@nestjs/common';
import { NotificationRouterService } from '../notifications/providers/notification-router.service';
import { RemindersService } from './reminders.service';
import type { DueReminder } from './reminders.types';

/** Nội dung push theo mốc khẩn của filter. */
function buildMessage(r: DueReminder): { title: string; body: string } {
  const d = `${r.daysRemaining} day${r.daysRemaining === 1 ? '' : 's'}`;
  if (r.stage === 'overdue') {
    return {
      title: 'Filter overdue',
      body: 'Your ice bath filter is overdue - replace it now to keep the water clean.',
    };
  }
  if (r.stage === 'soon') {
    return {
      title: 'Filter due soon',
      body: `Your filter is due in ${d}. Time to order a replacement.`,
    };
  }
  return {
    title: 'Filter reminder',
    body: `Your ice bath filter has ${d} left before the next change.`,
  };
}

/**
 * Orchestrate nhắc filter: scanDue → gửi push per-uid (qua NotificationRouterService: Tuya|FCM theo ENV) →
 * markNotified. Chống spam bằng lastNotifiedStage (chỉ nhắc khi ĐỔI mốc). Idempotent khi cron chạy lại.
 */
@Injectable()
export class RemindersCronService {
  private readonly logger = new Logger(RemindersCronService.name);

  constructor(
    private readonly reminders: RemindersService,
    private readonly router: NotificationRouterService,
  ) {}

  async processDue(): Promise<{
    scanned: number;
    notified: number;
    failed: number;
  }> {
    const due = await this.reminders.scanDue();
    let notified = 0;
    let failed = 0;
    for (const r of due) {
      const msg = buildMessage(r);
      try {
        await this.router.send({
          title: msg.title,
          body: msg.body,
          uids: [r.tuyaUid],
        });
        await this.reminders.markNotified(r.deviceId, r.stage); // chỉ mark khi gửi OK → lỗi sẽ thử lại lần cron sau
        notified += 1;
      } catch (e) {
        failed += 1;
        this.logger.warn(
          `Nhắc reminder ${r.deviceId} lỗi: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    this.logger.log(
      `scanDue: ${due.length} tới mốc → ${notified} nhắc, ${failed} lỗi`,
    );
    return { scanned: due.length, notified, failed };
  }
}
