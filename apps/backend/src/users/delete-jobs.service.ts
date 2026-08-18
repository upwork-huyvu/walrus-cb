import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_DELETE_ATTEMPTS = 5;

/** CRUD bảng delete_jobs (orchestration thực thi nằm ở UsersService). */
@Injectable()
export class DeleteJobsService {
  constructor(private readonly prisma: PrismaService) {}

  enqueue(tuyaUid: string) {
    return this.prisma.deleteJob.create({
      data: { tuyaUid, status: 'pending' },
    });
  }

  markDone(id: string) {
    return this.prisma.deleteJob.update({
      where: { id },
      data: { status: 'done' },
    });
  }

  markFailure(id: string, attempts: number, error: string) {
    const nextAttempts = attempts + 1;
    const status = nextAttempts >= MAX_DELETE_ATTEMPTS ? 'failed' : 'pending';
    return this.prisma.deleteJob.update({
      where: { id },
      data: { status, attempts: nextAttempts, lastError: error.slice(0, 500) },
    });
  }

  /**
   * uid của mọi user ĐÃ yêu cầu xoá (pre-delete đã gửi hoặc đang chờ retry).
   * Dùng để loại khỏi danh sách chính - user đã bấm xoá thì không nên còn nằm chung với user sống.
   * `failed` KHÔNG tính: pre-delete chưa từng tới Tuya nên user đó vẫn hoạt động bình thường.
   */
  async listDeletedUids(): Promise<string[]> {
    const rows = await this.prisma.deleteJob.findMany({
      where: { status: { in: ['pending', 'done'] } },
      select: { tuyaUid: true },
      distinct: ['tuyaUid'],
    });
    return rows.map((r) => r.tuyaUid);
  }

  /** Bản ghi thùng rác, mới nhất trước (1 dòng / uid). */
  async listDeleted() {
    return this.prisma.deleteJob.findMany({
      where: { status: { in: ['pending', 'done'] } },
      orderBy: { createdAt: 'desc' },
      distinct: ['tuyaUid'],
    });
  }

  /** Gỡ mọi job của uid - gọi sau khi đã xoá VĨNH VIỄN trên Tuya. */
  removeByUid(tuyaUid: string) {
    return this.prisma.deleteJob.deleteMany({ where: { tuyaUid } });
  }

  listPending(limit = 20) {
    return this.prisma.deleteJob.findMany({
      where: { status: 'pending', attempts: { lt: MAX_DELETE_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
