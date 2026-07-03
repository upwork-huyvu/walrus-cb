import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { UsersService } from '../users/users.service';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { SendPushDto } from './dto/send-push.dto';
import type { SendAppPushDto } from './dto/send-app-push.dto';
import type {
  PushBatchResult,
  PushResultItem,
  TuyaCreateTemplateResult,
  TuyaPushResult,
  TuyaTemplate,
  TuyaTemplateList,
} from './notifications.types';

// Tuya Cloud App Push Notification Service (IoT Core).
// Research: docs/research/tuya-cloud-app-push.md
const PUSH_PATH = '/v1.0/iot-03/messages/app-notifications/actions/push';
const TEMPLATES_PATH = '/v1.0/iot-03/msg-templates/app-notifications';

/**
 * Gửi thông báo tới end-user + quản lý template, qua Tuya Cloud OpenAPI.
 * Tái dùng TuyaCloudService (đã ký access_token). Dùng ở admin web (track admin/backend).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly tuya: TuyaCloudService,
    private readonly config: AppConfigService,
    private readonly users: UsersService,
  ) {}

  /**
   * Gửi push tới nhiều user (uids) hoặc TẤT CẢ (all=true). Tuya nhận 1 uid/lần →
   * loop tuần tự per-uid + tổng hợp kết quả (không có endpoint batch).
   */
  async sendPush(dto: SendPushDto): Promise<PushBatchResult> {
    const bizType = this.config.require('TUYA_APP_BIZ_TYPE');
    // template_param PHẢI là chuỗi JSON đã escape (không phải object).
    const templateParam = JSON.stringify(dto.params ?? {});
    const uids = dto.all ? await this.allUserUids() : (dto.uids ?? []);
    this.logger.log(
      `Gửi push template=${dto.templateId} biz_type=${bizType} → ${uids.length} user${dto.all ? ' (ALL)' : ''}`,
    );

    const results: PushResultItem[] = [];
    for (const uid of uids) {
      try {
        await this.tuya.request<TuyaPushResult>({
          method: 'POST',
          path: PUSH_PATH,
          body: {
            uid,
            biz_type: bizType,
            template_id: dto.templateId,
            template_param: templateParam,
          },
        });
        results.push({ uid, ok: true });
      } catch (e) {
        results.push({
          uid,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const success = results.filter((r) => r.ok).length;
    this.logger.log(
      `Push template=${dto.templateId}: ${success}/${uids.length} thành công`,
    );
    return {
      total: uids.length,
      success,
      failed: uids.length - success,
      results,
    };
  }

  /**
   * Gửi thông báo FREE-FORM (tên + mô tả) qua Tuya App Push, dùng template đã duyệt
   * (TUYA_APP_TEMPLATE_ID) với biến `${title}`/`${content}`. Tái dùng sendPush (per-uid loop).
   */
  async sendAppPush(dto: SendAppPushDto): Promise<PushBatchResult> {
    const templateId = this.config.require('TUYA_APP_TEMPLATE_ID');
    return this.sendPush({
      templateId,
      params: { title: dto.title, content: dto.body },
      uids: dto.uids,
      all: dto.all,
    });
  }

  /** Enumerate toàn bộ uid user Tuya (phân trang) cho "gửi tất cả". */
  private async allUserUids(): Promise<string[]> {
    const uids: string[] = [];
    for (let page = 1; page <= 100; page++) {
      const res = await this.users.listUsers({ page_no: page, page_size: 100 });
      uids.push(...res.list.map((u) => u.uid));
      if (!res.has_more) break;
    }
    return uids;
  }

  /** Danh sách template (xem id + trạng thái duyệt). */
  async listTemplates(): Promise<TuyaTemplateList> {
    return this.tuya.request<TuyaTemplateList>({
      method: 'GET',
      path: TEMPLATES_PATH,
    });
  }

  /** Chi tiết 1 template (theo dõi trạng thái duyệt). */
  async getTemplate(templateId: string): Promise<TuyaTemplate> {
    return this.tuya.request<TuyaTemplate>({
      method: 'GET',
      path: `${TEMPLATES_PATH}/${templateId}`,
    });
  }

  /** Tạo template (submit để Tuya duyệt ≤2 ngày làm việc) → trả template_id. */
  async createTemplate(
    dto: CreateTemplateDto,
  ): Promise<TuyaCreateTemplateResult> {
    return this.tuya.request<TuyaCreateTemplateResult>({
      method: 'POST',
      path: TEMPLATES_PATH,
      body: {
        name: dto.name,
        title: dto.title,
        content: dto.content,
        type: dto.type,
        remark: dto.remark,
      },
    });
  }
}
