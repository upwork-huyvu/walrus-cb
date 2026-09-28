import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';

export type AdminPrincipal = { id: string; email: string; role: AdminRole };

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
 *
 * Hai tầng tách bạch, đừng lẫn:
 * - **Supabase Auth** giữ tài khoản + mật khẩu (đăng nhập được hay không).
 * - **`admin_users`** chỉ là allowlist QUYỀN (vào được dashboard hay không, và với vai trò gì).
 * Gỡ admin = xoá dòng allowlist, tài khoản Supabase vẫn còn.
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

  /** Header cho Admin API của GoTrue. `service_role` là secret SERVER-ONLY, không bao giờ ra client. */
  private serviceHeaders(): Record<string, string> {
    const key = this.config.require('SUPABASE_SERVICE_ROLE_KEY');
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
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
    return { id: user.id, email: user.email, role: admin.role };
  }

  /** Chặn admin thường đụng vào việc quản lý admin. */
  private assertSuperadmin(actor: AdminPrincipal): void {
    if (actor.role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException('Chỉ superadmin mới được quản lý admin');
    }
  }

  /** Danh sách admin trong allowlist (email + vai trò + ngày tạo). */
  async listAdmins() {
    return this.prisma.adminUser.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Thêm admin mới (superadmin only): tạo tài khoản Supabase Auth rồi cấp quyền trong allowlist.
   *
   * Email đã có tài khoản Supabase thì KHÔNG đổi mật khẩu của người ta - chỉ cấp thêm quyền admin,
   * và trả `created: false` để UI nói thẳng là mật khẩu vừa nhập không được dùng.
   */
  async createAdmin(actor: AdminPrincipal, email: string, password: string) {
    this.assertSuperadmin(actor);
    // Supabase chuẩn hoá email về chữ thường; allowlist phải khớp y hệt thì `assertAdmin` mới tìm ra.
    const normalized = email.trim().toLowerCase();

    const existing = await this.prisma.adminUser.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      throw new ConflictException('Email này đã có quyền admin');
    }

    const created = await this.createSupabaseUser(normalized, password);
    const admin = await this.prisma.adminUser.create({
      data: { email: normalized, role: AdminRole.ADMIN },
    });
    return { ...admin, created };
  }

  /** `true` = vừa tạo tài khoản mới; `false` = email đã có tài khoản Supabase từ trước. */
  private async createSupabaseUser(
    email: string,
    password: string,
  ): Promise<boolean> {
    const { url } = this.supabase();
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: this.serviceHeaders(),
      // email_confirm: admin tạo hộ nên không bắt người ta bấm link xác nhận mới đăng nhập được.
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (res.ok) {
      return true;
    }
    if (res.status === 409 || res.status === 422) {
      return false; // đã đăng ký rồi - vẫn cấp quyền được, chỉ là giữ nguyên mật khẩu cũ
    }
    throw new InternalServerErrorException(
      `Không tạo được tài khoản Supabase (${res.status})`,
    );
  }

  /**
   * Tự đổi mật khẩu của CHÍNH MÌNH.
   *
   * Bắt nhập lại mật khẩu hiện tại chứ không chỉ tin Bearer token: token nằm trong cookie 8 tiếng,
   * ai mượn được máy lúc còn đăng nhập là đổi được mật khẩu và chiếm luôn tài khoản.
   */
  async changeOwnPassword(
    actor: AdminPrincipal,
    currentPassword: string,
    newPassword: string,
  ) {
    if (currentPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const { url, anon } = this.supabase();
    const check = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: actor.email, password: currentPassword }),
    });
    if (!check.ok) {
      // 400 chứ KHÔNG phải 401: admin web coi mọi 401 là "hết phiên → đá về /login", nên nếu
      // dùng 401 ở đây thì gõ sai mật khẩu hiện tại một cái là bị đăng xuất luôn.
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const res = await fetch(`${url}/auth/v1/admin/users/${actor.id}`, {
      method: 'PUT',
      headers: this.serviceHeaders(),
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Đổi mật khẩu thất bại (${res.status})`,
      );
    }
    return { updated: true };
  }

  /**
   * Gỡ 1 admin khỏi allowlist (revoke quyền admin). KHÔNG xoá tài khoản Supabase Auth -
   * chỉ mất quyền admin. Superadmin không gỡ được (kể cả tự gỡ) → dashboard không bao giờ
   * rơi vào trạng thái không còn ai quản lý admin.
   */
  async deleteAdmin(id: string, actor: AdminPrincipal) {
    this.assertSuperadmin(actor);
    const target = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy admin');
    }
    if (target.role === AdminRole.SUPERADMIN) {
      throw new ForbiddenException('Không thể gỡ quyền của superadmin');
    }
    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true, email: target.email };
  }
}
