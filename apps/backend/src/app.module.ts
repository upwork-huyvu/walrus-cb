import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { TuyaModule } from './tuya/tuya.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AppConfigModule, // global: config + env validation
    PrismaModule, // global: Postgres (Supabase)
    TuyaModule, // Tuya Cloud OpenAPI client
    AdminAuthModule, // auth admin (Supabase) + guard
    HealthModule, // GET /health
    UsersModule, // list/detail/xoá user + delete_jobs cron (bọc AdminAuthGuard)
    NotificationsModule, // gửi push + quản lý template qua Tuya Cloud App Push (bọc AdminAuthGuard)
  ],
})
export class AppModule {}
