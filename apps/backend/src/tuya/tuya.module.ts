import { Module } from '@nestjs/common';
import { TuyaTokenService } from './token.service';
import { TuyaCloudService } from './tuya-cloud.service';
import { TuyaAppInfoService } from './app-info.service';

@Module({
  providers: [TuyaTokenService, TuyaCloudService, TuyaAppInfoService],
  exports: [TuyaTokenService, TuyaCloudService, TuyaAppInfoService],
})
export class TuyaModule {}
