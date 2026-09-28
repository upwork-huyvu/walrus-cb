import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /** Bắt nhập lại để token bị mượn cũng không đổi được mật khẩu. */
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
