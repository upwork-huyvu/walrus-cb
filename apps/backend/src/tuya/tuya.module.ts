import { Module } from '@nestjs/common';
import { TuyaTokenService } from './token.service';
import { TuyaCloudService } from './tuya-cloud.service';

@Module({
  providers: [TuyaTokenService, TuyaCloudService],
  exports: [TuyaTokenService, TuyaCloudService],
})
export class TuyaModule {}
