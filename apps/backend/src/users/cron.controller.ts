import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from './users.service';

// Vercel Cron gọi GET endpoint này (kèm Authorization: Bearer ${CRON_SECRET}).
// @nestjs/schedule không chạy trên serverless → dùng Vercel Cron (xem vercel.json).
@Controller('internal/cron')
export class CronController {
  constructor(
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  @Get('process-delete-jobs')
  process(@Headers('authorization') authorization?: string) {
    const expected = `Bearer ${this.config.require('CRON_SECRET')}`;
    if (authorization !== expected) {
      throw new UnauthorizedException('Sai hoặc thiếu CRON_SECRET');
    }
    return this.users.processPendingDeletions();
  }
}
