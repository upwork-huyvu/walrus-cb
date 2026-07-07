import { Module } from '@nestjs/common';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersCronService } from './reminders-cron.service';
import { RemindersCronController } from './reminders-cron.controller';

// PrismaModule + AppConfigModule là @Global. MobileAuthModule cấp guard (api-key+uid+ownership).
// UsersModule (export UsersService) BẮT BUỘC: DeviceOwnershipGuard được Nest resolve TRONG scope
// module chứa controller (RemindersController) nên UsersService phải có ở đây - thiếu → crash boot
// (UnknownDependenciesException). NotificationsModule cấp NotificationRouterService cho cron.
@Module({
  imports: [MobileAuthModule, UsersModule, NotificationsModule],
  controllers: [RemindersController, RemindersCronController],
  providers: [RemindersService, RemindersCronService],
  exports: [RemindersService],
})
export class RemindersModule {}
