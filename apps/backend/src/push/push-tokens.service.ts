import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterTokenDto } from './dto/register-token.dto';

/** Lưu/gỡ FCM token map với Tuya uid (bảng push_tokens). token @unique → upsert idempotent. */
@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đăng ký/cập nhật token. Upsert theo `token` (unique): cùng thiết bị đăng ký lại (đổi user/platform)
   * → cập nhật tuyaUid+platform thay vì tạo bản mới (tránh token mồ côi gắn user cũ).
   */
  async upsert(dto: RegisterTokenDto): Promise<{ id: string }> {
    const row = await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: {
        tuyaUid: dto.tuyaUid,
        token: dto.token,
        platform: dto.platform,
      },
      update: { tuyaUid: dto.tuyaUid, platform: dto.platform },
      select: { id: true },
    });
    this.logger.log(
      `Đăng ký token (uid=${dto.tuyaUid}, platform=${dto.platform}).`,
    );
    return row;
  }

  /** Gỡ 1 token (logout). Không tồn tại → coi như thành công (idempotent). */
  async removeByToken(token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token } });
  }

  /** Lấy toàn bộ token của 1 uid (để gửi FCM). */
  async listTokensByUid(tuyaUid: string): Promise<string[]> {
    const rows = await this.prisma.pushToken.findMany({
      where: { tuyaUid },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  /** Danh sách uid (duy nhất) có ít nhất 1 token - dùng cho "gửi tất cả" (chỉ user đã đăng ký FCM). */
  async listAllUids(): Promise<string[]> {
    const rows = await this.prisma.pushToken.findMany({
      distinct: ['tuyaUid'],
      select: { tuyaUid: true },
    });
    return rows.map((r) => r.tuyaUid);
  }

  /** Xoá các token chết (FCM báo not-registered) → dọn DB. */
  async pruneTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.pushToken.deleteMany({
      where: { token: { in: tokens } },
    });
    this.logger.log(`Đã prune ${tokens.length} token chết.`);
  }
}
