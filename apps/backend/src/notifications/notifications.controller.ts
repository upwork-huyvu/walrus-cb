import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendPushDto } from './dto/send-push.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AdminAuthGuard) // chỉ admin (Supabase Auth + allowlist) mới gọi được
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Gửi 1 thông báo tới 1 user. */
  @Post('push')
  push(@Body() dto: SendPushDto) {
    return this.notifications.sendPush(dto);
  }

  /** Danh sách template. */
  @Get('templates')
  listTemplates() {
    return this.notifications.listTemplates();
  }

  /** Chi tiết 1 template (trạng thái duyệt). */
  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.notifications.getTemplate(id);
  }

  /** Tạo template (submit để duyệt). */
  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.notifications.createTemplate(dto);
  }
}
