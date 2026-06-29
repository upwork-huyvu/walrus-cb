import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

export type AdminPrincipal = { id: string; email: string };

type SupabaseUser = { id: string; email?: string };
type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: SupabaseUser;
};

/**
 * Auth admin qua Supabase Auth (GoTrue). Verify token bằng cách gọi /auth/v1/user
 * (algorithm-agnostic). Admin phải nằm trong allowlist `admin_users` → tách biệt end-user.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private supabase(): { url: string; anon: string } {
    return {
      url: this.config.require('SUPABASE_URL'),
      anon: this.config.require('SUPABASE_ANON_KEY'),
    };
  }

  /** Đăng nhập admin (password grant). Chỉ trả session nếu là admin trong allowlist. */
  async login(email: string, password: string): Promise<SupabaseSession> {
    const { url, anon } = this.supabase();
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new UnauthorizedException('Đăng nhập admin thất bại');
    }
    const session = (await res.json()) as SupabaseSession;
    await this.assertAdmin(session.user);
    return session;
  }

  /** Verify Bearer token với Supabase + kiểm tra allowlist admin. */
  async getAdminFromToken(token: string): Promise<AdminPrincipal> {
    const { url, anon } = this.supabase();
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const user = (await res.json()) as SupabaseUser;
    return this.assertAdmin(user);
  }

  private async assertAdmin(user: SupabaseUser): Promise<AdminPrincipal> {
    if (!user?.email) {
      throw new UnauthorizedException('Token thiếu email');
    }
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: user.email },
    });
    if (!admin) {
      throw new ForbiddenException('Tài khoản không có quyền admin');
    }
    return { id: user.id, email: user.email };
  }
}
