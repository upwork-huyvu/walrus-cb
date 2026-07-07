// Vercel serverless entrypoint - bọc Nest app trên Express (cache giữa các invocation).
// LƯU Ý: build bởi @vercel/node (không qua `nest build`). Deploy là hành động riêng
// (KHÔNG tự deploy). Cron in-process (@nestjs/schedule) KHÔNG chạy trên serverless -
// delete_jobs ở C2 sẽ dùng Vercel Cron / worker.
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { Express, Request, Response } from 'express';
import { AppModule } from '../src/app.module';

let cached: Express | undefined;

async function bootstrap(): Promise<Express> {
  if (cached) return cached;
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.init();
  cached = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  try {
    const server = await bootstrap();
    server(req, res);
  } catch (err) {
    // Boot lỗi (thiếu env / engine Prisma / DB không nối được...) → log full vào Vercel Runtime Logs
    // + trả JSON để thấy ngay qua curl, thay vì "FUNCTION_INVOCATION_FAILED" mù. Siết lại khi ổn định.
    console.error('[api] bootstrap failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'BOOTSTRAP_FAILED', message });
  }
}
