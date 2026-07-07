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
  const server = await bootstrap();
  server(req, res);
}
