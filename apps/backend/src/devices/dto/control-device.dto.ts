import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

/**
 * Ý muốn điều khiển 1 thiết bị. Mọi field optional - gửi field nào thì điều khiển field đó.
 * `target` = nhiệt độ HIỂN THỊ (vd 7.5). Service nhân scale + encode raw base64 khi cần.
 */
export class ControlDeviceDto {
  @IsNumber()
  @IsOptional()
  target?: number;

  @IsBoolean()
  @IsOptional()
  power?: boolean;

  @IsBoolean()
  @IsOptional()
  light?: boolean;

  @IsBoolean()
  @IsOptional()
  purify?: boolean;
}
