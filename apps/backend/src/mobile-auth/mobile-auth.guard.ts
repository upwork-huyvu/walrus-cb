import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';

/** Request đã gắn uid sau khi qua MobileAuthGuard. */
export type AuthedRequest = Request & { uid?: string };

/**
 * Auth kênh mobile→backend (MVP - quyết định 2026-07-06, xem docs/research/tuya-app-session-verification.md):
 * so `x-api-key` với PUSH_API_KEY (dùng chung) + lấy uid từ `x-tuya-uid` → gắn req.uid.
 * ⚠️ Tin uid từ app (Tuya không cho backend verify session). Rủi ro khai-uid được giảm nhẹ bằng: uid Tuya mờ/khó
 * đoán + rate-limit; endpoint device-scoped siết thêm bằng DeviceOwnershipGuard. Nâng cấp Supabase/OAuth sau.
 */
@Injectable()
export class MobileAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.require('PUSH_API_KEY');
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const key = firstHeader(req.headers['x-api-key']);
    if (!key || !safeEqual(key, expected)) {
      throw new UnauthorizedException('API key không hợp lệ');
    }
    const uid = firstHeader(req.headers['x-tuya-uid']);
    if (!uid) {
      throw new UnauthorizedException('Thiếu header x-tuya-uid');
    }
    req.uid = uid;
    return true;
  }
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false; // length khác → timingSafeEqual throw; check trước
  return timingSafeEqual(ab, bb);
}
