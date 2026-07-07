import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  MobileAuthGuard,
  type AuthedRequest,
} from '../mobile-auth/mobile-auth.guard';
import { NotificationLogService } from './notification-log.service';

/**
 * Lịch sử thông báo per-user (mobile-facing). MobileAuthGuard (api-key + uid) → chỉ trả log của
 * chính uid gọi. App gộp danh sách này (nguồn FCM) với Tuya Message Center (m1-notification-history).
 */
@Controller('me')
@UseGuards(MobileAuthGuard)
export class NotificationsHistoryController {
  constructor(private readonly log: NotificationLogService) {}

  @Get('notifications')
  list(
    @Req() req: AuthedRequest,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    const off = Math.max(0, Number.parseInt(offset ?? '0', 10) || 0);
    const lim = Math.min(
      50,
      Math.max(1, Number.parseInt(limit ?? '20', 10) || 20),
    );
    return this.log.listForUid(req.uid as string, off, lim);
  }

  /** Xoá 1 thông báo của chính mình (idempotent - chỉ xoá dòng có tuyaUid == uid gọi). */
  @Delete('notifications/:id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.log.deleteForUid(req.uid as string, id);
  }
}
