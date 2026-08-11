import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { DevicesService } from './devices.service';
import { ControlDeviceDto } from './dto/control-device.dto';

@Controller('admin/devices')
@UseGuards(AdminAuthGuard) // chỉ admin (Supabase Auth + allowlist) mới gọi được
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Tất cả thiết bị của mọi user (trang quản lý phẳng). */
  @Get()
  list() {
    return this.devices.listAllDevices();
  }

  /**
   * Thiết bị của MỘT user (màn "All devices" trong trang chi tiết user).
   * Khai TRƯỚC `@Get(':id')` cho rõ ý: đường dẫn 2 đoạn nên không đụng route 1 đoạn, nhưng để
   * cạnh nhau thì người đọc sau khỏi phải tự kiểm tra điều đó.
   */
  @Get('by-user/:uid')
  byUser(@Param('uid') uid: string) {
    return this.devices.listByUser(uid);
  }

  /** Chi tiết + trạng thái đã decode của 1 thiết bị. */
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.devices.getDevice(id);
  }

  /** Gửi lệnh điều khiển (target temp / power / light / purify) qua Cloud. */
  @Post(':id/commands')
  command(@Param('id') id: string, @Body() dto: ControlDeviceDto) {
    return this.devices.sendCommand(id, dto);
  }
}
