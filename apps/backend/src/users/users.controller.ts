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

  /**
   * Thùng rác - user đang trong ân hạn xoá của Tuya.
   * Khai TRƯỚC `@Get(':uid')`: cả hai đều là đường dẫn 1 đoạn nên NestJS chọn theo THỨ TỰ khai
   * báo; đặt sau thì `/users/deleted` sẽ bị nuốt thành `uid = "deleted"`.
   */
  @Get('deleted')
  listDeleted() {
    return this.users.listDeleted();
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

  /** Xoá VĨNH VIỄN từ thùng rác - bỏ qua ân hạn 7 ngày, không hoàn tác. */
  @Delete(':uid/permanent')
  purge(@Param('uid') uid: string) {
    return this.users.purgeUser(uid);
  }
}
