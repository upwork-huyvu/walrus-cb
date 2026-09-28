import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard, type AdminRequest } from './admin-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: AdminRequest) {
    return req.admin;
  }

  /** Tự đổi mật khẩu của chính mình - admin thường cũng làm được. */
  @Patch('me/password')
  @UseGuards(AdminAuthGuard)
  changePassword(@Req() req: AdminRequest, @Body() dto: ChangePasswordDto) {
    return this.auth.changeOwnPassword(
      req.admin!,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ---- Quản lý admin (allowlist). Thêm/gỡ: SUPERADMIN only (chặn trong service). ----
  @Get('users')
  @UseGuards(AdminAuthGuard)
  listAdmins() {
    return this.auth.listAdmins();
  }

  @Post('users')
  @UseGuards(AdminAuthGuard)
  createAdmin(@Req() req: AdminRequest, @Body() dto: CreateAdminDto) {
    return this.auth.createAdmin(req.admin!, dto.email, dto.password);
  }

  @Delete('users/:id')
  @UseGuards(AdminAuthGuard)
  removeAdmin(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.auth.deleteAdmin(id, req.admin!);
  }
}
