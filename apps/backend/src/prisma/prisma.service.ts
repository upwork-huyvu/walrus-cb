import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: AppConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Cho phép boot mà chưa có DB (điền DATABASE_URL sau). Chỉ connect khi đã cấu hình.
    if (!this.config.get('DATABASE_URL')) {
      this.logger.warn(
        'DATABASE_URL chưa cấu hình → bỏ qua kết nối Postgres. Điền .env để bật.',
      );
      return;
    }
    await this.$connect();
    this.logger.log('Prisma đã kết nối Postgres (Supabase).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
