import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard, type AdminRequest } from './admin-auth.guard';
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
}
