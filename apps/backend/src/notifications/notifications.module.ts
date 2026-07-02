import { Module } from '@nestjs/common';
import { TuyaModule } from '../tuya/tuya.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// PrismaModule + AppConfigModule là @Global nên không cần import lại.
@Module({
  imports: [TuyaModule, AdminAuthModule, UsersModule], // +UsersModule: enumerate uid khi "gửi tất cả"
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
