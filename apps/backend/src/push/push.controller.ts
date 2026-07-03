import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { PushService } from './push.service';

/**
 * Body cho POST /push/send — admin gửi noti FCM tự do (KHÔNG template): tên (title) + mô tả (body)
 * + cấu hình (data cho tap-routing). Người nhận: `uids` (≥1) HOẶC `all=true` (mọi user đã đăng ký token).
 */
export class SendPushDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  /** data tuỳ chọn (vd { screen:'device-detail', devId:'...' }) để app điều hướng khi tap. */
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;

  /** Gửi tới TẤT CẢ user đã đăng ký FCM token. */
  @IsBoolean()
  @IsOptional()
  all?: boolean;

  /** Danh sách uid nhận (bắt buộc khi không `all`). */
  @ValidateIf((o: SendPushDto) => !o.all)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  uids?: string[];
}

// Endpoint gửi — bảo vệ bằng AdminAuthGuard (chỉ admin). Kênh FCM tự do (khác Tuya Cloud template push).
@Controller('push')
@UseGuards(AdminAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('send')
  send(@Body() dto: SendPushDto) {
    const payload = { title: dto.title, body: dto.body, data: dto.data };
    if (dto.all) return this.push.sendToAll(payload);
    if (!dto.uids || dto.uids.length === 0) {
      throw new BadRequestException(
        'Cần chọn người nhận (uids) hoặc all=true.',
      );
    }
    return this.push.sendToUids(dto.uids, payload);
  }
}
