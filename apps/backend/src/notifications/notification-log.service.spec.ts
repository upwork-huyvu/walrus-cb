import { NotificationLogService } from './notification-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationLogService', () => {
  const createMany = jest.fn();
  const findMany = jest.fn();
  const deleteMany = jest.fn();
  const prisma = {
    notificationLog: { createMany, findMany, deleteMany },
  } as unknown as PrismaService;

  let service: NotificationLogService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationLogService(prisma);
  });

  it('record: 1 dòng / uid; danh sách rỗng → no-op (không gọi DB)', async () => {
    await service.record([], { title: 'T', body: 'B', provider: 'fcm' });
    expect(createMany).not.toHaveBeenCalled();

    await service.record(['u1', 'u2'], {
      title: 'T',
      body: 'B',
      provider: 'fcm',
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          tuyaUid: 'u1',
          title: 'T',
          body: 'B',
          provider: 'fcm',
          data: undefined,
        },
        {
          tuyaUid: 'u2',
          title: 'T',
          body: 'B',
          provider: 'fcm',
          data: undefined,
        },
      ],
    });
  });

  it('listForUid: query đúng (desc, skip, take+1) + map ra content/dateTime + hasMore', async () => {
    const rows = [
      {
        id: 'a',
        title: 'T1',
        body: 'B1',
        provider: 'fcm',
        sentAt: new Date('2026-07-07T00:00:00Z'),
      },
      {
        id: 'b',
        title: 'T2',
        body: 'B2',
        provider: 'fcm',
        sentAt: new Date('2026-07-06T00:00:00Z'),
      },
      {
        id: 'c',
        title: 'T3',
        body: 'B3',
        provider: 'fcm',
        sentAt: new Date('2026-07-05T00:00:00Z'),
      },
    ];
    findMany.mockResolvedValue(rows); // 3 rows, limit=2 → hasMore, trả 2
    const r = await service.listForUid('u1', 0, 2);
    expect(findMany).toHaveBeenCalledWith({
      where: { tuyaUid: 'u1' },
      orderBy: { sentAt: 'desc' },
      skip: 0,
      take: 3,
    });
    expect(r.hasMore).toBe(true);
    expect(r.list).toHaveLength(2);
    expect(r.list[0]).toEqual({
      id: 'a',
      title: 'T1',
      content: 'B1',
      provider: 'fcm',
      dateTime: '2026-07-07T00:00:00.000Z',
    });
  });

  it('listForUid: ít hơn limit → hasMore=false', async () => {
    findMany.mockResolvedValue([
      {
        id: 'a',
        title: 'T',
        body: 'B',
        provider: 'fcm',
        sentAt: new Date('2026-07-07T00:00:00Z'),
      },
    ]);
    const r = await service.listForUid('u1', 0, 20);
    expect(r.hasMore).toBe(false);
    expect(r.list).toHaveLength(1);
  });

  it('deleteForUid: deleteMany theo {id, tuyaUid} (scope đúng chủ, không xoá của người khác)', async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await service.deleteForUid('u1', 'log-1');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'log-1', tuyaUid: 'u1' },
    });
  });
});
