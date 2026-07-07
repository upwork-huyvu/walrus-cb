import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from './reminders.service';
import { computeStage } from './reminders.types';

// now cố định để test countdown tất định.
const NOW = new Date('2026-07-06T00:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

describe('computeStage (countdown + mức khẩn - AC2)', () => {
  const stage = (intervalDays: number, elapsedDays: number) =>
    computeStage(intervalDays, daysAgo(elapsedDays), NOW);

  it('mới thay → daysRemaining = intervalDays, stage ok', () => {
    expect(stage(90, 0)).toEqual({ daysRemaining: 90, stage: 'ok' });
  });

  it('biên các mốc: 22 ok · 21 warn · 8 warn · 7 soon · 0 soon · -1 overdue', () => {
    expect(stage(90, 68).stage).toBe('ok'); // 22 còn lại
    expect(stage(90, 69).stage).toBe('warn'); // 21
    expect(stage(90, 82).stage).toBe('warn'); // 8
    expect(stage(90, 83).stage).toBe('soon'); // 7
    expect(stage(90, 90).stage).toBe('soon'); // 0
    expect(stage(90, 91)).toEqual({ daysRemaining: -1, stage: 'overdue' }); // quá hạn
  });
});

describe('RemindersService', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const update = jest.fn();
  const deleteMany = jest.fn();
  const prisma = {
    deviceReminder: { findUnique, upsert, update, deleteMany },
  } as unknown as PrismaService;

  let service: RemindersService;
  beforeEach(() => {
    jest.clearAllMocks();
    // getForDevice dùng Date.now() thật (khác scanDue/computeStage nhận `now`) → freeze về NOW
    // để countdown tất định, không lệch theo ngày chạy test.
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    service = new RemindersService(prisma);
  });
  afterEach(() => jest.restoreAllMocks());

  const row = (
    over: Partial<{
      intervalDays: number;
      lastReplacedAt: Date;
      enabled: boolean;
    }> = {},
  ) => ({
    deviceId: 'dev-1',
    type: 'filter',
    intervalDays: 90,
    lastReplacedAt: daysAgo(85),
    enabled: true,
    ...over,
  });

  it('getForDevice: null khi chưa có', async () => {
    findUnique.mockResolvedValue(null);
    expect(await service.getForDevice('dev-1')).toBeNull();
  });

  it('getForDevice: trả view kèm countdown', async () => {
    findUnique.mockResolvedValue(row({ lastReplacedAt: daysAgo(85) })); // còn 5 ngày
    const v = await service.getForDevice('dev-1');
    expect(v?.daysRemaining).toBe(5);
    expect(v?.stage).toBe('soon');
    expect(typeof v?.lastReplacedAt).toBe('string'); // ISO
  });

  it('upsertForDevice: upsert theo deviceId (1/thiết bị - AC1), create set tuyaUid', async () => {
    upsert.mockResolvedValue(row());
    await service.upsertForDevice('uid-1', 'dev-1', {
      intervalDays: 60,
      enabled: false,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deviceId: 'dev-1' },
        create: {
          tuyaUid: 'uid-1',
          deviceId: 'dev-1',
          intervalDays: 60,
          enabled: false,
        },
        update: { intervalDays: 60, enabled: false },
      }),
    );
  });

  it('upsertForDevice: bỏ trống field → không ghi đè (patch rỗng)', async () => {
    upsert.mockResolvedValue(row());
    await service.upsertForDevice('uid-1', 'dev-1', {});
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { tuyaUid: 'uid-1', deviceId: 'dev-1' },
        update: {},
      }),
    );
  });

  it('markReplaced: set lastReplacedAt=now + reset lastNotifiedStage (AC2)', async () => {
    update.mockResolvedValue(row({ lastReplacedAt: new Date(NOW) }));
    await service.markReplaced('dev-1');
    const calls = update.mock.calls as Array<
      [
        {
          where: { deviceId: string };
          data: { lastReplacedAt: Date; lastNotifiedStage: string | null };
        },
      ]
    >;
    const arg = calls[0][0];
    expect(arg.where).toEqual({ deviceId: 'dev-1' });
    expect(arg.data.lastNotifiedStage).toBeNull();
    expect(arg.data.lastReplacedAt).toBeInstanceOf(Date);
  });

  it('deleteForDevice: deleteMany theo deviceId (idempotent)', async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await service.deleteForDevice('dev-1');
    expect(deleteMany).toHaveBeenCalledWith({ where: { deviceId: 'dev-1' } });
  });
});

describe('RemindersService.scanDue (chống spam - AC4)', () => {
  const findMany = jest.fn();
  const prisma = { deviceReminder: { findMany } } as unknown as PrismaService;
  const service = new RemindersService(prisma);
  beforeEach(() => jest.clearAllMocks());

  const rem = (over: Record<string, unknown>) => ({
    tuyaUid: 'u',
    deviceId: 'd',
    intervalDays: 90,
    lastReplacedAt: daysAgo(85), // 5 ngày còn lại → 'soon'
    enabled: true,
    lastNotifiedStage: null,
    ...over,
  });

  it('reminder tới mốc + chưa nhắc mốc đó → vào danh sách due', async () => {
    findMany.mockResolvedValue([rem({ deviceId: 'd1' })]);
    const due = await service.scanDue(NOW);
    expect(due).toEqual([
      { tuyaUid: 'u', deviceId: 'd1', stage: 'soon', daysRemaining: 5 },
    ]);
    expect(findMany).toHaveBeenCalledWith({ where: { enabled: true } });
  });

  it('đã nhắc đúng mốc (lastNotifiedStage === stage) → KHÔNG nhắc lại', async () => {
    findMany.mockResolvedValue([rem({ lastNotifiedStage: 'soon' })]);
    expect(await service.scanDue(NOW)).toEqual([]);
  });

  it('đổi mốc (đã nhắc warn, giờ soon) → nhắc lại', async () => {
    findMany.mockResolvedValue([rem({ lastNotifiedStage: 'warn' })]);
    expect((await service.scanDue(NOW))[0].stage).toBe('soon');
  });

  it('stage ok (chưa tới mốc) → không nhắc', async () => {
    findMany.mockResolvedValue([rem({ lastReplacedAt: daysAgo(10) })]); // còn 80 → ok
    expect(await service.scanDue(NOW)).toEqual([]);
  });
});
