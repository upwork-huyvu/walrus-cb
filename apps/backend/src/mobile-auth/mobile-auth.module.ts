import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MobileAuthGuard } from './mobile-auth.guard';
import { DeviceOwnershipGuard } from './device-ownership.guard';

// Auth kênh mobile→backend (api-key + uid) + ownership check thiết bị. Dùng chung cho reminders + (sau) /me/*.
// AppConfigModule @Global cấp config cho MobileAuthGuard; UsersModule cấp UsersService cho ownership guard.
@Module({
  imports: [UsersModule],
  providers: [MobileAuthGuard, DeviceOwnershipGuard],
  exports: [MobileAuthGuard, DeviceOwnershipGuard],
})
export class MobileAuthModule {}
