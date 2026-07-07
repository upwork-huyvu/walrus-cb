import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';

// Guard cho endpoint user-facing (mobile đăng ký/gỡ FCM token): so header `x-api-key` với PUSH_API_KEY.
// MVP: tin `tuyaUid` trong body (rủi ro spoof đã ghi trong plan). So sánh hằng thời gian tránh timing attack.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.require('PUSH_API_KEY');
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-api-key'];
    const value = Array.isArray(provided) ? provided[0] : provided;
    if (!value || !safeEqual(value, expected)) {
      throw new UnauthorizedException('API key không hợp lệ');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false; // length khác → timingSafeEqual throw; check trước
  return timingSafeEqual(ab, bb);
}
