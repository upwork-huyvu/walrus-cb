import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService, type AdminPrincipal } from './admin-auth.service';

export type AdminRequest = Request & { admin?: AdminPrincipal };

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu Bearer token');
    }
    const token = header.slice('Bearer '.length);
    req.admin = await this.auth.getAdminFromToken(token);
    return true;
  }
}
