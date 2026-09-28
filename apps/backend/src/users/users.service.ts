import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { DeleteJobsService } from './delete-jobs.service';
import type { ListUsersQueryDto } from './dto/list-users.query';
import type {
  TuyaUserDevice,
  TuyaUserInfo,
  TuyaUserListResult,
} from './tuya-user.types';

export type DeletionResult = {
  uid: string;
  jobId: string;
  status: string; // done | pending | failed
  error?: string;
};

/** Một user của app kèm thiết bị của họ - snapshot dùng chung cho `/users` và `/admin/devices`. */
export type UserRosterEntry = {
  info: TuyaUserInfo;
  /** `null` = gọi Tuya lỗi. KHÁC HẲN `[]` (user thật sự chưa pair máy nào). */
  devices: TuyaUserDevice[] | null;
};

/** Trần quét roster - chặn một app đông user làm nổ số request sang Tuya. */
const MAX_ROSTER = 500;
/** Số request Tuya chạy song song khi dựng roster (Tuya có rate limit). */
const ROSTER_CONCURRENCY = 8;

/** `Promise.all` có trần song song - giữ số kết nối tới Tuya trong tầm kiểm soát. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly tuya: TuyaCloudService,
    private readonly prisma: PrismaService,
    private readonly jobs: DeleteJobsService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Danh sách user + số thiết bị (đếm THẲNG từ Tuya).
   *
   * Phân trang TẠI CHỖ chứ không đẩy `page_no` sang Tuya: roster phải gom từ hai nguồn rồi mới
   * sắp xếp được, nên `total`/`has_more` chỉ đúng khi đã có đủ danh sách. Đổi lại con số hiển
   * thị luôn khớp số dòng thật - quy mô app tính bằng chục user nên chi phí không đáng kể.
   */
  async listUsers(query: ListUsersQueryDto) {
    const roster = await this.loadRoster();
    // `username` của Tuya là tra khớp CHÍNH XÁC và ném `2006 user not exist` khi trượt (→ 500).
    // Lọc tại chỗ giữ đúng ngữ nghĩa đó mà không bao giờ dựng lỗi.
    const matched = query.username
      ? roster.filter((e) => e.info.username === query.username)
      : roster;
    const start = (query.page_no - 1) * query.page_size;
    const page = matched.slice(start, start + query.page_size);

    return {
      list: page.map((e) => ({
        ...e.info,
        // `null` = không đếm được (Tuya lỗi). Để `0` ở đây thì admin hiện "Inactive" cho một
        // khách đang có bồn chạy - sai nguy hiểm hơn là thú nhận không biết.
        business: { deviceCount: e.devices ? e.devices.length : null },
      })),
      total: matched.length,
      has_more: start + page.length < matched.length,
      page_no: query.page_no,
      page_size: query.page_size,
    };
  }

  /**
   * Ảnh chụp TOÀN BỘ user của app (profile + thiết bị), người đăng ký mới nhất đứng trước.
   *
   * ⚠️ KHÔNG chỉ dựa vào `GET /v2.0/apps/{schema}/users`. Đo trên hệ thống thật (2026-09-28):
   * endpoint đó chỉ trả 2/6 user còn sống của app - 4 người đăng ký khoảng 03/08→17/08 bị Tuya
   * bỏ sót dù `/v1.0/users/{uid}/infos` vẫn đọc bình thường, và một trong số đó đang có bồn
   * ONLINE. Nên roster = danh sách Tuya ∪ uid mà backend đã tự lưu (push token, reminder).
   */
  async loadRoster(): Promise<UserRosterEntry[]> {
    const uids = await this.rosterUids();
    const entries = await mapLimit(uids, ROSTER_CONCURRENCY, async (uid) => {
      const info = await this.tuya
        .request<TuyaUserInfo>({ path: `/v1.0/users/${uid}/infos` })
        .catch(() => null);
      // Tuya từ chối đọc (uid của app SDK cũ, hoặc data center đã bị khoá) → không có gì để
      // hiển thị; bỏ hẳn khỏi danh sách thay vì đẩy ra một dòng trống không bấm được.
      if (!info) return null;
      const devices = await this.getUserDevices(uid).catch(() => null);
      return { info: { ...info, uid }, devices };
    });
    return entries
      .filter((e): e is UserRosterEntry => e !== null)
      .sort((a, b) => (b.info.create_time ?? 0) - (a.info.create_time ?? 0));
  }

  /** uid cần hiển thị: Tuya ∪ backend, đã trừ user trong thùng rác, chặn trên bằng MAX_ROSTER. */
  private async rosterUids(): Promise<string[]> {
    const [fromTuya, fromDb, deleted] = await Promise.all([
      this.appUserUids(),
      this.knownUids(),
      this.jobs.listDeletedUids(),
    ]);
    // Tuya `pre-delete` có ân hạn 7 ngày nên user VẪN nằm trong response suốt thời gian đó;
    // không lọc thì admin bấm xoá xong vẫn thấy nguyên si. `seen` kiêm luôn dedupe hai nguồn.
    const seen = new Set(deleted);
    const out: string[] = [];
    for (const uid of [...fromTuya, ...fromDb]) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      out.push(uid);
      if (out.length >= MAX_ROSTER) break;
    }
    return out;
  }

  /** uid từ `GET /v2.0/apps/{schema}/users` (duyệt hết trang). Lỗi → rỗng, để nguồn DB gánh. */
  private async appUserUids(): Promise<string[]> {
    const schema = this.config.require('TUYA_APP_SCHEMA');
    const uids: string[] = [];
    const maxPages = Math.ceil(MAX_ROSTER / 100);
    for (let page = 1; page <= maxPages; page++) {
      const res = await this.tuya
        .request<TuyaUserListResult>({
          method: 'GET',
          path: `/v2.0/apps/${schema}/users`,
          query: { page_no: page, page_size: 100 },
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Danh sách user của app lỗi: ${message}`);
          return null;
        });
      if (!res) break;
      uids.push(...(res.list ?? []).map((u) => u.uid));
      if (!res.has_more) break;
    }
    return uids;
  }

  /**
   * uid mà chính backend đã lưu: ai đăng ký push token hoặc đặt nhắc bảo trì thì chắc chắn đã
   * đăng nhập app thật - kể cả khi danh sách của Tuya bỏ sót họ.
   */
  private async knownUids(): Promise<string[]> {
    if (!this.config.get('DATABASE_URL')) return [];
    try {
      const [tokens, reminders] = await Promise.all([
        this.prisma.pushToken.findMany({
          select: { tuyaUid: true },
          distinct: ['tuyaUid'],
        }),
        this.prisma.deviceReminder.findMany({
          select: { tuyaUid: true },
          distinct: ['tuyaUid'],
        }),
      ]);
      return [...tokens, ...reminders].map((r) => r.tuyaUid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Không đọc được uid từ DB: ${message}`);
      return [];
    }
  }

  /** Chi tiết user (Tuya). */
  async getUser(uid: string) {
    return this.tuya.request<TuyaUserInfo>({
      method: 'GET',
      path: `/v1.0/users/${uid}/infos`,
    });
  }

  /**
   * Thiết bị Tuya của user (GET /v1.0/users/{uid}/devices - result là mảng trực tiếp).
   * Lược bỏ `local_key` (secret của thiết bị - không bao giờ đưa về admin FE).
   */
  async getUserDevices(uid: string): Promise<TuyaUserDevice[]> {
    const devices = await this.tuya.request<
      (TuyaUserDevice & { local_key?: string })[]
    >({
      method: 'GET',
      path: `/v1.0/users/${uid}/devices`,
    });
    return (devices ?? []).map((d) => {
      const { local_key, ...rest } = d;
      void local_key;
      return rest;
    });
  }

  /**
   * Thùng rác: user đã yêu cầu xoá, đang trong ân hạn 7 ngày của Tuya.
   * Cố lấy thêm thông tin hiển thị (email/nickname) - user vẫn tồn tại trên Tuya cho tới khi hết
   * hạn nên thường lấy được; nếu Tuya đã xoá thật rồi thì chỉ còn uid, và đó là trạng thái hợp lệ.
   */
  async listDeleted() {
    const jobs = await this.jobs.listDeleted();
    return Promise.all(
      jobs.map(async (j) => {
        const info = await this.tuya
          .request<TuyaUserInfo>({
            method: 'GET',
            path: `/v1.0/users/${j.tuyaUid}/infos`,
          })
          .catch(() => null);
        return {
          uid: j.tuyaUid,
          status: j.status,
          deletedAt: j.createdAt,
          lastError: j.lastError,
          email: info?.email,
          username: info?.username,
          nickName: info?.nick_name,
          avatar: info?.avatar,
          stillOnTuya: info != null,
        };
      }),
    );
  }

  /**
   * Khôi phục user đang trong ân hạn - huỷ lệnh pre-delete ở Tuya.
   * `POST /v1.0/users/{uid}/actions/cancel-delete` (Undelete, chỉ dùng được trong 7 ngày):
   * https://developer.tuya.com/en/docs/cloud/7795856216?id=Kawfjiiunt8nm
   *
   * ⚠️ THỨ TỰ QUAN TRỌNG: gọi Tuya TRƯỚC, thành công mới xoá bản ghi job. Làm ngược lại mà Tuya
   * lỗi thì user hiện lại trong danh sách admin nhưng Tuya VẪN xoá thật khi hết hạn - khôi phục
   * nửa vời còn tệ hơn không khôi phục, vì không ai biết là nó sắp biến mất.
   */
  async restoreUser(uid: string): Promise<{ uid: string; restored: true }> {
    await this.tuya.request<boolean>({
      method: 'POST',
      path: `/v1.0/users/${uid}/actions/cancel-delete`,
    });
    await this.jobs.removeByUid(uid);
    return { uid, restored: true };
  }

  /**
   * Xoá VĨNH VIỄN (hard delete) - bỏ qua ân hạn, không hoàn tác được.
   * Chỉ gọi từ thùng rác: user phải đã qua bước pre-delete trước đó.
   * Tuya đã tự xoá sau 7 ngày (404/lỗi) vẫn coi là thành công - kết quả cuối cùng giống nhau,
   * và bản ghi thùng rác phải được dọn thì admin mới hết thấy dòng chết.
   */
  async purgeUser(uid: string): Promise<{ uid: string; purged: true }> {
    await this.tuya
      .request<{ result?: boolean }>({
        method: 'DELETE',
        path: `/v1.0/iot-02/users/${uid}`,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Hard delete ${uid}: ${message} - vẫn dọn bản ghi`);
      });
    if (this.config.get('DATABASE_URL')) {
      await this.prisma.deviceMapping.deleteMany({ where: { tuyaUid: uid } });
    }
    await this.jobs.removeByUid(uid);
    return { uid, purged: true };
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
}
