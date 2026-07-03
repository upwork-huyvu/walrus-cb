import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { firebaseMessagingProvider } from './firebase.provider';
import { ApiKeyGuard } from './api-key.guard';
import { PushTokensService } from './push-tokens.service';
import { PushService } from './push.service';
import { PushTokensController } from './push-tokens.controller';
import { PushController } from './push.controller';

// PrismaModule + AppConfigModule là @Global. AdminAuthModule cấp AdminAuthGuard cho PushController.
@Module({
  imports: [AdminAuthModule],
  controllers: [PushTokensController, PushController],
  providers: [
    firebaseMessagingProvider,
    ApiKeyGuard,
    PushTokensService,
    PushService,
  ],
})
export class PushModule {}
