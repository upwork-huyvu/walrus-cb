import { IsIn, IsString, MinLength } from 'class-validator';

/** Body cho POST /push/tokens - mobile đăng ký FCM token gắn với Tuya uid. */
export class RegisterTokenDto {
  /** Tuya uid (định danh user). MVP: tin từ app (guard chỉ là API key dùng chung). */
  @IsString()
  @MinLength(1)
  tuyaUid!: string;

  /** FCM registration token của thiết bị. */
  @IsString()
  @MinLength(1)
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}
