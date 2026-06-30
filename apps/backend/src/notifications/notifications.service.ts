import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { SendPushDto } from './dto/send-push.dto';
import type {
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
  ) {}

  /** Gửi 1 push tới 1 user theo template đã duyệt. */
  async sendPush(dto: SendPushDto): Promise<TuyaPushResult> {
    const bizType = this.config.require('TUYA_APP_BIZ_TYPE');
    // template_param PHẢI là chuỗi JSON đã escape (không phải object).
    const templateParam = JSON.stringify(dto.params ?? {});
    this.logger.log(
      `Gửi push uid=${dto.uid} template=${dto.templateId} biz_type=${bizType}`,
    );
    return this.tuya.request<TuyaPushResult>({
      method: 'POST',
      path: PUSH_PATH,
      body: {
        uid: dto.uid,
        biz_type: bizType,
        template_id: dto.templateId,
        template_param: templateParam,
      },
    });
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
