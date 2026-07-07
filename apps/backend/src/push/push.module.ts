import { Module } from '@nestjs/common';
import { firebaseMessagingProvider } from './firebase.provider';
import { ApiKeyGuard } from './api-key.guard';
import { PushTokensService } from './push-tokens.service';
import { PushService } from './push.service';
import { PushTokensController } from './push-tokens.controller';

// PrismaModule + AppConfigModule là @Global. Gửi FCM đi qua NotificationsModule (provider router) →
// module này chỉ giữ: đăng ký token (mobile, api-key) + PushService (export cho FcmProvider).
@Module({
  controllers: [PushTokensController],
  providers: [
    firebaseMessagingProvider,
    ApiKeyGuard,
    PushTokensService,
    PushService,
  ],
  exports: [PushService],
})
export class PushModule {}
