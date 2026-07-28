import { Module } from '@nestjs/common';
import { TuyaModule } from '../tuya/tuya.module';
import { UsersModule } from '../users/users.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

// TuyaModule → TuyaCloudService · UsersModule → UsersService (list users + getUserDevices)
// · AdminAuthModule → AdminAuthGuard cho controller.
@Module({
  imports: [TuyaModule, UsersModule, AdminAuthModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
