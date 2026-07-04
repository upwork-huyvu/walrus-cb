import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ListUsersQueryDto } from './dto/list-users.query';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AdminAuthGuard) // chỉ admin (Supabase Auth + allowlist) mới gọi được
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.listUsers(query);
  }

  @Get(':uid')
  detail(@Param('uid') uid: string) {
    return this.users.getUser(uid);
  }

  @Get(':uid/devices')
  devices(@Param('uid') uid: string) {
    return this.users.getUserDevices(uid);
  }

  @Delete(':uid')
  remove(@Param('uid') uid: string) {
    return this.users.deleteUser(uid);
  }
}
