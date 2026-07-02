import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

/**
 * Body cho POST /notifications/push — admin gửi thông báo.
 * Chọn người nhận: `uids` (danh sách ≥1) HOẶC `all=true` (tất cả user Tuya, backend enumerate).
 * Tuya Cloud push nhận 1 uid/lần → backend loop per-uid (không có batch/broadcast).
 */
export class SendPushDto {
  /** Template đã duyệt (vd "PUSH_1616396456"). */
  @IsString()
  templateId!: string;

  /**
   * Biến điền vào template, map tới placeholder `${var}` trong title/content.
   * Service serialize thành `template_param` (chuỗi JSON) khi gọi Tuya.
   */
  @IsObject()
  @IsOptional()
  params?: Record<string, string>;

  /** Gửi tới TẤT CẢ user Tuya (bỏ qua `uids`). */
  @IsBoolean()
  @IsOptional()
  all?: boolean;

  /** Danh sách Tuya uid người nhận — bắt buộc ≥1 khi `all` !== true. */
  @ValidateIf((o: SendPushDto) => o.all !== true)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  uids?: string[];
}
