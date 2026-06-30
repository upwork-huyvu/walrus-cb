import { IsObject, IsOptional, IsString } from 'class-validator';

/** Body cho POST /notifications/push — admin gửi 1 thông báo tới 1 user. */
export class SendPushDto {
  /** Tuya user id người nhận. */
  @IsString()
  uid!: string;

  /** Template đã duyệt (vd "PUSH_1616396456"). */
  @IsString()
  templateId!: string;

  /**
   * Biến điền vào template, map tới placeholder `${var}` trong title/content.
   * Service sẽ serialize thành `template_param` (chuỗi JSON) khi gọi Tuya.
   */
  @IsObject()
  @IsOptional()
  params?: Record<string, string>;
}
