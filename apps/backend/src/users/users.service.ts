import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { DeleteJobsService } from './delete-jobs.service';
import type { ListUsersQueryDto } from './dto/list-users.query';
import type { TuyaUserInfo, TuyaUserListResult } from './tuya-user.types';

export type DeletionResult = {
  uid: string;
  jobId: string;
  status: string; // done | pending | failed
  error?: string;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly tuya: TuyaCloudService,
    private readonly prisma: PrismaService,
    private readonly jobs: DeleteJobsService,
    private readonly config: AppConfigService,
  ) {}

  /** Danh sách user (Tuya Cloud) + ghép business data (số device mapping). */
  async listUsers(query: ListUsersQueryDto) {
    const schema = this.config.require('TUYA_APP_SCHEMA');
    const result = await this.tuya.request<TuyaUserListResult>({
      method: 'GET',
      path: `/v2.0/apps/${schema}/users`,
      query: {
        page_no: query.page_no,
        page_size: query.page_size,
        username: query.username,
      },
    });

    const list = result.list ?? [];
    const counts = await this.deviceCounts(list.map((u) => u.uid));

    return {
      list: list.map((u) => ({
        ...u,
        business: { deviceCount: counts.get(u.uid) ?? 0 },
      })),
      total: result.total ?? list.length,
      has_more: result.has_more ?? false,
      page_no: query.page_no,
      page_size: query.page_size,
    };
  }

  /** Chi tiết user (Tuya) + business data (device mappings). */
  async getUser(uid: string) {
    const info = await this.tuya.request<TuyaUserInfo>({
      method: 'GET',
      path: `/v1.0/users/${uid}/infos`,
    });
    const deviceMappings = this.config.get('DATABASE_URL')
      ? await this.prisma.deviceMapping.findMany({ where: { tuyaUid: uid } })
      : [];
    return { ...info, business: { deviceMappings } };
  }

  /** Xoá user: Tuya pre-delete + xoá business data; ghi delete_jobs (retry nếu lỗi). */
  async deleteUser(uid: string): Promise<DeletionResult> {
    const job = await this.jobs.enqueue(uid);
    return this.executeJob({
      id: job.id,
      tuyaUid: job.tuyaUid,
      attempts: job.attempts,
    });
  }

  /** Quét + retry các job pending (gọi bởi Vercel Cron). */
  async processPendingDeletions() {
    const pending = await this.jobs.listPending();
    const results: DeletionResult[] = [];
    for (const job of pending) {
      results.push(
        await this.executeJob({
          id: job.id,
          tuyaUid: job.tuyaUid,
          attempts: job.attempts,
        }),
      );
    }
    return { processed: results.length, results };
  }

  // --- internal ---

  private async executeJob(job: {
    id: string;
    tuyaUid: string;
    attempts: number;
  }): Promise<DeletionResult> {
    try {
      // 1) Tuya pre-delete (ân hạn 7 ngày)
      await this.tuya.request<boolean>({
        method: 'POST',
        path: `/v1.0/users/${job.tuyaUid}/actions/pre-delete`,
      });
      // 2) Xoá business data ở Supabase
      if (this.config.get('DATABASE_URL')) {
        await this.prisma.deviceMapping.deleteMany({
          where: { tuyaUid: job.tuyaUid },
        });
      }
      // 3) Đánh dấu xong
      await this.jobs.markDone(job.id);
      return { uid: job.tuyaUid, jobId: job.id, status: 'done' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Xoá user ${job.tuyaUid} lỗi: ${message}`);
      const updated = await this.jobs.markFailure(
        job.id,
        job.attempts,
        message,
      );
      return {
        uid: job.tuyaUid,
        jobId: job.id,
        status: updated.status,
        error: message,
      };
    }
  }

  private async deviceCounts(uids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (uids.length === 0 || !this.config.get('DATABASE_URL')) return map;
    const grouped = await this.prisma.deviceMapping.groupBy({
      by: ['tuyaUid'],
      where: { tuyaUid: { in: uids } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      map.set(g.tuyaUid, g._count._all);
    }
    return map;
  }
}
