import { Module } from '@nestjs/common';
import { TuyaModule } from '../tuya/tuya.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UsersController } from './users.controller';
import { CronController } from './cron.controller';
import { UsersService } from './users.service';
import { DeleteJobsService } from './delete-jobs.service';

// PrismaModule + AppConfigModule là @Global nên không cần import lại.
@Module({
  imports: [TuyaModule, AdminAuthModule], // AdminAuthModule cấp AdminAuthGuard cho UsersController
  controllers: [UsersController, CronController],
  providers: [UsersService, DeleteJobsService],
})
export class UsersModule {}
