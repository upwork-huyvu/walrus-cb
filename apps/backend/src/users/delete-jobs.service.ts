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

  listPending(limit = 20) {
    return this.prisma.deleteJob.findMany({
      where: { status: 'pending', attempts: { lt: MAX_DELETE_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
