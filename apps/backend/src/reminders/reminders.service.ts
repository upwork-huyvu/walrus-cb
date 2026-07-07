import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeStage,
  NOTIFY_STAGES,
  type DueReminder,
  type ReminderStage,
  type ReminderView,
} from './reminders.types';

/** Input cập nhật reminder (tạo/sửa). */
export type UpsertReminderInput = {
  intervalDays?: number;
  enabled?: boolean;
};

/**
 * Reminder bảo trì theo thiết bị. deviceId @unique = mỗi thiết bị 1 reminder (upsert idempotent).
 * Countdown suy từ lastReplacedAt + intervalDays (không lưu số ngày trực tiếp → không lệch theo thời gian).
 */
@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(r: {
    deviceId: string;
    type: string;
    intervalDays: number;
    lastReplacedAt: Date;
    enabled: boolean;
  }): ReminderView {
    const { daysRemaining, stage } = computeStage(
      r.intervalDays,
      r.lastReplacedAt,
    );
    return {
      deviceId: r.deviceId,
      type: r.type,
      intervalDays: r.intervalDays,
      lastReplacedAt: r.lastReplacedAt.toISOString(),
      enabled: r.enabled,
      daysRemaining,
      stage,
    };
  }

  /** Reminder của 1 thiết bị (kèm countdown) - null nếu chưa tạo. */
  async getForDevice(deviceId: string): Promise<ReminderView | null> {
    const r = await this.prisma.deviceReminder.findUnique({
      where: { deviceId },
    });
    return r ? this.toView(r) : null;
  }

  /**
   * Tạo/cập nhật reminder cho thiết bị (upsert theo deviceId → đảm bảo 1/thiết bị, AC1).
   * tuyaUid chỉ set lúc CREATE (chủ sở hữu cố định); update không đụng tuyaUid.
   */
  async upsertForDevice(
    tuyaUid: string,
    deviceId: string,
    input: UpsertReminderInput,
  ): Promise<ReminderView> {
    const patch = {
      ...(input.intervalDays != null
        ? { intervalDays: input.intervalDays }
        : {}),
      ...(input.enabled != null ? { enabled: input.enabled } : {}),
    };
    const r = await this.prisma.deviceReminder.upsert({
      where: { deviceId },
      create: { tuyaUid, deviceId, ...patch },
      update: patch,
    });
    return this.toView(r);
  }

  /** "Replaced now": đặt lastReplacedAt = now → countdown về intervalDays; reset mốc nhắc (AC2). */
  async markReplaced(deviceId: string): Promise<ReminderView> {
    const r = await this.prisma.deviceReminder.update({
      where: { deviceId },
      data: { lastReplacedAt: new Date(), lastNotifiedStage: null },
    });
    return this.toView(r);
  }

  /** Xoá reminder của thiết bị (idempotent). */
  async deleteForDevice(deviceId: string): Promise<void> {
    await this.prisma.deviceReminder.deleteMany({ where: { deviceId } });
  }

  /**
   * Quét reminder `enabled` tới mốc CẦN nhắc mà CHƯA nhắc ở mốc đó (stage ∈ NOTIFY_STAGES &&
   * stage != lastNotifiedStage) → chống spam khi cron chạy lại (AC4). Thuần logic + 1 query.
   */
  async scanDue(now: number = Date.now()): Promise<DueReminder[]> {
    const rows = await this.prisma.deviceReminder.findMany({
      where: { enabled: true },
    });
    const due: DueReminder[] = [];
    for (const r of rows) {
      const { daysRemaining, stage } = computeStage(
        r.intervalDays,
        r.lastReplacedAt,
        now,
      );
      if (NOTIFY_STAGES.includes(stage) && stage !== r.lastNotifiedStage) {
        due.push({
          tuyaUid: r.tuyaUid,
          deviceId: r.deviceId,
          stage,
          daysRemaining,
        });
      }
    }
    return due;
  }

  /** Ghi mốc đã nhắc (sau khi cron gửi push thành công) → không nhắc lại cùng mốc. */
  async markNotified(deviceId: string, stage: ReminderStage): Promise<void> {
    await this.prisma.deviceReminder.update({
      where: { deviceId },
      data: { lastNotifiedStage: stage },
    });
  }
}
