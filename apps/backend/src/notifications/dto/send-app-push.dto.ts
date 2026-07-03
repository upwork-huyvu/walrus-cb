import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Body cho POST /notifications/send — gửi thông báo FREE-FORM qua Tuya App Push.
 * title/body được map vào biến `${title}`/`${content}` của template đã duyệt (TUYA_APP_TEMPLATE_ID).
 * Giới hạn Tuya: title ≤ 40, content ≤ 100 ký tự.
 */
export class SendAppPushDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  body!: string;

  /** Gửi tới TẤT CẢ user Tuya (bỏ qua `uids`). */
  @IsBoolean()
  @IsOptional()
  all?: boolean;

  /** Danh sách Tuya uid người nhận — bắt buộc ≥1 khi `all` !== true. */
  @ValidateIf((o: SendAppPushDto) => o.all !== true)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  uids?: string[];
}
