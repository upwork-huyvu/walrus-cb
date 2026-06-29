import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  buildSignUrl,
  buildStringToSign,
  calcSign,
  newNonce,
  nowTimestamp,
} from './tuya-sign';

type CachedToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};

type TuyaTokenResponse = {
  success: boolean;
  code?: number;
  msg?: string;
  result?: {
    access_token: string;
    refresh_token: string;
    uid: string;
    expire_time: number; // giây
  };
};

const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class TuyaTokenService {
  private readonly logger = new Logger(TuyaTokenService.name);
  private cached?: CachedToken;

  constructor(private readonly config: AppConfigService) {}

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh &&
      this.cached &&
      this.cached.expiresAt - REFRESH_SKEW_MS > Date.now()
    ) {
      return this.cached.accessToken;
    }
    this.cached = await this.fetchToken();
    return this.cached.accessToken;
  }

  private async fetchToken(): Promise<CachedToken> {
    const endpoint = this.config.get('TUYA_OPENAPI_ENDPOINT');
    const clientId = this.config.require('TUYA_ACCESS_ID');
    const secret = this.config.require('TUYA_ACCESS_SECRET');

    const signUrl = buildSignUrl('/v1.0/token', { grant_type: 1 });
    const t = nowTimestamp();
    const nonce = newNonce();
    const stringToSign = buildStringToSign('GET', signUrl); // body rỗng
    const sign = calcSign({ clientId, secret, t, nonce, stringToSign }); // token-style

    const res = await fetch(`${endpoint}${signUrl}`, {
      method: 'GET',
      headers: {
        client_id: clientId,
        sign,
        t,
        nonce,
        sign_method: 'HMAC-SHA256',
      },
    });
    const json = (await res.json()) as TuyaTokenResponse;
    if (!json.success || !json.result) {
      throw new Error(
        `Lấy Tuya token thất bại: code=${json.code} msg=${json.msg}`,
      );
    }
    this.logger.log('Đã lấy Tuya access_token mới.');
    return {
      accessToken: json.result.access_token,
      refreshToken: json.result.refresh_token,
      expiresAt: Date.now() + json.result.expire_time * 1000,
    };
  }
}
