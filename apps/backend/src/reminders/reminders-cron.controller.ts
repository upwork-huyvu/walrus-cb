import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { RemindersCronService } from './reminders-cron.service';

// Vercel Cron gọi endpoint này (Authorization: Bearer ${CRON_SECRET}) - quét reminder tới hạn → push.
// @nestjs/schedule không chạy trên serverless → dùng Vercel Cron (xem vercel.json).
@Controller('internal/cron')
export class RemindersCronController {
  constructor(
    private readonly cron: RemindersCronService,
    private readonly config: AppConfigService,
  ) {}

  @Get('process-reminders')
  process(@Headers('authorization') authorization?: string) {
    const expected = `Bearer ${this.config.require('CRON_SECRET')}`;
    if (authorization !== expected) {
      throw new UnauthorizedException('Sai hoặc thiếu CRON_SECRET');
    }
    return this.cron.processDue();
  }
}
