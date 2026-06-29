import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.validation';

/** Truy cập env có kiểu + helper require() (throw rõ ràng khi thiếu secret). */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  require<K extends keyof Env>(key: K): NonNullable<Env[K]> {
    const value = this.config.get(key, { infer: true });
    if (value === undefined || value === null || value === '') {
      throw new Error(
        `Thiếu env bắt buộc: ${String(key)} (điền vào .env trên server).`,
      );
    }
    return value;
  }
}
