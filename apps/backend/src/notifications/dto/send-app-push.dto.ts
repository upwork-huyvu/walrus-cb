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
 * Body cho POST /notifications/send - gửi thông báo FREE-FORM. Router chọn Tuya App Push | FCM theo ENV.
 * TUYA: title/body map vào `${title}`/`${content}` của template (Tuya Cloud giới hạn ~40/~100 ký tự).
 * FCM: title/body + imageUrl (ảnh) + screen (deeplink → data.screen). imageUrl/screen bị bỏ qua khi provider=tuya.
 */
export class SendAppPushDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;

  /** Gửi tới TẤT CẢ user Tuya (bỏ qua `uids`). */
  @IsBoolean()
  @IsOptional()
  all?: boolean;

  /** Danh sách Tuya uid người nhận - bắt buộc ≥1 khi `all` !== true. */
  @ValidateIf((o: SendAppPushDto) => o.all !== true)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  uids?: string[];

  /** (FCM) URL ảnh hiển thị trong notification. Tuya template bỏ qua. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  /** (FCM) Deeplink - tên màn app mở khi tap (→ data.screen). Tuya template bỏ qua. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  screen?: string;
}
