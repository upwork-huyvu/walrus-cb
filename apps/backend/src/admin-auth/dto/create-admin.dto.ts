import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  /** Supabase mặc định tối thiểu 6 ký tự; ép 8 vì đây là tài khoản quản trị. */
  @IsString()
  @MinLength(8)
  password!: string;
}
