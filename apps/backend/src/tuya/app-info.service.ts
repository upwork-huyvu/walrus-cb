import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { TuyaCloudService } from './tuya-cloud.service';

// Get App Details: GET /v1.0/apps/{schema} → biz_type của app (Rev 2 — bỏ cấu hình env thủ công).
// ⚠️ Doc lệch casing: bảng field ghi `app_biz_type`, example lại `appBizType` → parse CẢ HAI.
// https://developer.tuya.com/en/docs/cloud/0ebeab240f?id=Kawfawol4q13d
type TuyaAppDetails = {
  app_id?: number;
  app_name?: string;
  app_biz_type?: number;
  appBizType?: number;
};

/** Tra biz_type của app lúc runtime (memoize — biz_type bất biến per app). Env = override khẩn cấp. */
@Injectable()
export class TuyaAppInfoService {
  private readonly logger = new Logger(TuyaAppInfoService.name);
  private cached?: Promise<number>;

  constructor(
    private readonly tuya: TuyaCloudService,
    private readonly config: AppConfigService,
  ) {}

  async getBizType(): Promise<number> {
    // Override qua env (giữ đường thoát khi API đổi/permission thiếu).
    const fromEnv = this.config.get('TUYA_APP_BIZ_TYPE');
    if (fromEnv != null) return Number(fromEnv);

    // Memoized promise: nhiều request đồng thời chỉ bắn 1 call; lỗi → xoá cache để lần sau thử lại.
    this.cached ??= this.fetchBizType().catch((e) => {
      this.cached = undefined;
      throw e;
    });
    return this.cached;
  }

  private async fetchBizType(): Promise<number> {
    const schema = this.config.require('TUYA_APP_SCHEMA');
    const res = await this.tuya.request<TuyaAppDetails>({
      method: 'GET',
      path: `/v1.0/apps/${schema}`,
    });
    const bizType = res.app_biz_type ?? res.appBizType;
    if (bizType == null) {
      throw new Error(
        `Get App Details (schema=${schema}) không trả app_biz_type/appBizType — kiểm tra API product "App Management" đã authorize vào project chưa.`,
      );
    }
    this.logger.log(`biz_type của app ${schema} = ${bizType} (resolve runtime, đã cache)`);
    return bizType;
  }
}
