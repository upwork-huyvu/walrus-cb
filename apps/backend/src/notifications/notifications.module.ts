import { Module } from '@nestjs/common';
import { TuyaModule } from '../tuya/tuya.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UsersModule } from '../users/users.module';
import { PushModule } from '../push/push.module';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsHistoryController } from './notifications-history.controller';
import { NotificationsService } from './notifications.service';
import { NotificationLogService } from './notification-log.service';
import { TuyaNotificationProvider } from './providers/tuya.provider';
import { FcmNotificationProvider } from './providers/fcm.provider';
import { NotificationRouterService } from './providers/notification-router.service';

// PrismaModule + AppConfigModule là @Global nên không cần import lại.
// PushModule cấp PushService cho FcmProvider + PushTokensService cho router (log "all").
// MobileAuthModule cấp MobileAuthGuard cho NotificationsHistoryController (mobile đọc lịch sử của mình).
@Module({
  imports: [
    TuyaModule,
    AdminAuthModule,
    UsersModule,
    PushModule,
    MobileAuthModule,
  ],
  controllers: [NotificationsController, NotificationsHistoryController],
  providers: [
    NotificationsService,
    NotificationLogService,
    TuyaNotificationProvider,
    FcmNotificationProvider,
    NotificationRouterService,
  ],
  exports: [NotificationRouterService], // RemindersModule (cron) dùng để gửi nhắc filter
})
export class NotificationsModule {}
