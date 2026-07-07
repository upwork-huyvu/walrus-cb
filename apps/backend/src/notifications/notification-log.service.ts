import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProviderName } from './providers/notification-provider';

export type LoggedNotification = {
  id: string;
  title: string;
  content: string;
  provider: ProviderName;
  dateTime: string; // ISO
};

/**
 * Lịch sử thông báo backend đã gửi (bảng notification_logs), 1 dòng / recipient uid.
 * Nguồn "FCM history" cho app; provider=tuya app vẫn đọc qua Tuya Message Center nên không dùng bảng này.
 */
@Injectable()
export class NotificationLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ghi 1 dòng cho mỗi uid nhận. No-op khi danh sách rỗng. */
  async record(
    uids: string[],
    payload: {
      title: string;
      body: string;
      provider: ProviderName;
      data?: Record<string, string>;
    },
  ): Promise<void> {
    if (uids.length === 0) return;
    await this.prisma.notificationLog.createMany({
      data: uids.map((uid) => ({
        tuyaUid: uid,
        title: payload.title,
        body: payload.body,
        provider: payload.provider,
        data: payload.data ?? undefined,
      })),
    });
  }

  /** Lịch sử của 1 uid (mới nhất trước, phân trang). take+1 để biết hasMore. */
  async listForUid(
    uid: string,
    offset: number,
    limit: number,
  ): Promise<{ list: LoggedNotification[]; hasMore: boolean }> {
    const rows = await this.prisma.notificationLog.findMany({
      where: { tuyaUid: uid },
      orderBy: { sentAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const list = rows.slice(0, limit).map((r) => ({
      id: r.id,
      title: r.title,
      content: r.body,
      provider: r.provider as ProviderName,
      dateTime: r.sentAt.toISOString(),
    }));
    return { list, hasMore };
  }

  /** Xoá 1 log của ĐÚNG uid (idempotent; deleteMany + điều kiện tuyaUid → không xoá của người khác). */
  async deleteForUid(uid: string, id: string): Promise<void> {
    await this.prisma.notificationLog.deleteMany({
      where: { id, tuyaUid: uid },
    });
  }
}
