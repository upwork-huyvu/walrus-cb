import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { TuyaModule } from './tuya/tuya.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    AppConfigModule, // global: config + env validation
    PrismaModule, // global: Postgres (Supabase)
    TuyaModule, // Tuya Cloud OpenAPI client
    AdminAuthModule, // auth admin (Supabase) + guard
    HealthModule, // GET /health
    UsersModule, // list/detail/xoá user + delete_jobs cron (bọc AdminAuthGuard)
    NotificationsModule, // gửi push + quản lý template qua Tuya Cloud App Push (bọc AdminAuthGuard)
    PushModule, // FCM provider: đăng ký token (api-key) + gửi FCM (dùng khi NOTIFICATION_PROVIDER=fcm)
    RemindersModule, // nhắc bảo trì theo thiết bị (mobile: api-key+uid+ownership guard)
  ],
})
export class AppModule {}
