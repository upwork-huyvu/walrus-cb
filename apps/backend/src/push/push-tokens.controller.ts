import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UnregisterTokenDto } from './dto/unregister-token.dto';
import { PushTokensService } from './push-tokens.service';

// Endpoint user-facing (mobile) - bảo vệ bằng API key dùng chung (x-api-key).
@Controller('push/tokens')
@UseGuards(ApiKeyGuard)
export class PushTokensController {
  constructor(private readonly tokens: PushTokensService) {}

  /** Đăng ký/cập nhật FCM token khi login / onTokenRefresh. */
  @Post()
  register(@Body() dto: RegisterTokenDto) {
    return this.tokens.upsert(dto);
  }

  /** Gỡ token khi logout. */
  @Delete()
  @HttpCode(204)
  async unregister(@Body() dto: UnregisterTokenDto): Promise<void> {
    await this.tokens.removeByToken(dto.token);
  }
}
