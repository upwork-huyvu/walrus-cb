import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { TuyaTokenService } from './token.service';
import {
  buildSignUrl,
  buildStringToSign,
  calcSign,
  newNonce,
  nowTimestamp,
} from './tuya-sign';

export type TuyaRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

type TuyaApiResponse<T> = {
  success: boolean;
  code?: number;
  msg?: string;
  t?: number;
  result?: T;
};

/**
 * Client gọi Tuya Cloud OpenAPI cho business request (ký kèm access_token).
 * Dùng ở UserModule (C2) để list/xoá user.
 */
@Injectable()
export class TuyaCloudService {
  constructor(
    private readonly config: AppConfigService,
    private readonly tokenService: TuyaTokenService,
  ) {}

  async request<T = unknown>(req: TuyaRequest): Promise<T> {
    const endpoint = this.config.get('TUYA_OPENAPI_ENDPOINT');
    const clientId = this.config.require('TUYA_ACCESS_ID');
    const secret = this.config.require('TUYA_ACCESS_SECRET');
    const accessToken = await this.tokenService.getAccessToken();

    const method = req.method ?? 'GET';
    const bodyStr =
      req.body === undefined ? undefined : JSON.stringify(req.body);
    const signUrl = buildSignUrl(req.path, req.query);
    const t = nowTimestamp();
    const nonce = newNonce();
    const stringToSign = buildStringToSign(method, signUrl, bodyStr);
    const sign = calcSign({
      clientId,
      secret,
      t,
      nonce,
      stringToSign,
      accessToken,
    });

    const res = await fetch(`${endpoint}${signUrl}`, {
      method,
      headers: {
        client_id: clientId,
        access_token: accessToken,
        sign,
        t,
        nonce,
        sign_method: 'HMAC-SHA256',
        ...(bodyStr ? { 'Content-Type': 'application/json' } : {}),
      },
      body: bodyStr,
    });
    const json = (await res.json()) as TuyaApiResponse<T>;
    if (!json.success) {
      throw new Error(
        `Tuya API lỗi [${method} ${req.path}]: code=${json.code} msg=${json.msg}`,
      );
    }
    return json.result as T;
  }
}
