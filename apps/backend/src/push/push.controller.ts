import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { PushService } from './push.service';

/** Body cho POST /push/send — admin/hệ thống gửi 1 noti FCM tới 1 uid (dùng để test đường ống). */
export class SendToUidDto {
  @IsString()
  @MinLength(1)
  tuyaUid!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}

// Endpoint gửi — bảo vệ bằng AdminAuthGuard (chỉ admin, giống notifications). Kênh FCM (khác Tuya Cloud push).
@Controller('push')
@UseGuards(AdminAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('send')
  send(@Body() dto: SendToUidDto) {
    return this.push.sendToUid(dto.tuyaUid, {
      title: dto.title,
      body: dto.body,
      data: dto.data,
    });
  }
}
