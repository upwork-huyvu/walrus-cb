import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { DeleteJobsService } from './delete-jobs.service';
import { UsersService } from './users.service';

describe('UsersService.deleteUser (orchestration)', () => {
  const tuyaRequest = jest.fn();
  const enqueue = jest.fn();
  const markDone = jest.fn();
  const markFailure = jest.fn();
  const listPending = jest.fn();
  const deleteMany = jest.fn();
  const configGet = jest.fn();

  const tuya = { request: tuyaRequest } as unknown as TuyaCloudService;
  const prisma = {
    deviceMapping: { deleteMany },
  } as unknown as PrismaService;
  const jobs = {
    enqueue,
    markDone,
    markFailure,
    listPending,
  } as unknown as DeleteJobsService;
  const config = { get: configGet } as unknown as AppConfigService;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    configGet.mockReturnValue('postgres://x'); // DATABASE_URL có → cleanup chạy
    service = new UsersService(tuya, prisma, jobs, config);
  });

  it('success: pre-delete + cleanup + markDone → status done', async () => {
    enqueue.mockResolvedValue({ id: 'j1', tuyaUid: 'u1', attempts: 0 });
    tuyaRequest.mockResolvedValue(true);
    deleteMany.mockResolvedValue({ count: 2 });
    markDone.mockResolvedValue({ id: 'j1', status: 'done' });

    const res = await service.deleteUser('u1');

    expect(res.status).toBe('done');
    expect(tuyaRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/v1.0/users/u1/actions/pre-delete',
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({ where: { tuyaUid: 'u1' } });
    expect(markDone).toHaveBeenCalledWith('j1');
    expect(markFailure).not.toHaveBeenCalled();
  });

  it('Tuya lỗi → markFailure, không cleanup, status pending', async () => {
    enqueue.mockResolvedValue({ id: 'j2', tuyaUid: 'u2', attempts: 0 });
    tuyaRequest.mockRejectedValue(new Error('boom'));
    markFailure.mockResolvedValue({ id: 'j2', status: 'pending' });

    const res = await service.deleteUser('u2');

    expect(res.status).toBe('pending');
    expect(res.error).toContain('boom');
    expect(markFailure).toHaveBeenCalledWith('j2', 0, 'boom');
    expect(deleteMany).not.toHaveBeenCalled();
    expect(markDone).not.toHaveBeenCalled();
  });

  it('processPendingDeletions xử lý mọi job pending', async () => {
    listPending.mockResolvedValue([
      { id: 'j1', tuyaUid: 'u1', attempts: 0 },
      { id: 'j2', tuyaUid: 'u2', attempts: 1 },
    ]);
    tuyaRequest.mockResolvedValue(true);
    deleteMany.mockResolvedValue({ count: 0 });
    markDone.mockResolvedValue({ status: 'done' });

    const res = await service.processPendingDeletions();

    expect(res.processed).toBe(2);
    expect(tuyaRequest).toHaveBeenCalledTimes(2);
    expect(markDone).toHaveBeenCalledTimes(2);
  });

  describe('listUsers (enrich nick_name/avatar)', () => {
    it('ghép nick_name/avatar từ endpoint detail; user lỗi thì giữ nguyên field list', async () => {
      const configRich = {
        get: jest.fn().mockReturnValue(undefined), // không DATABASE_URL → bỏ qua deviceCounts
        require: jest.fn().mockReturnValue('schema1'),
      } as unknown as AppConfigService;
      const svc = new UsersService(tuya, prisma, jobs, configRich);

      tuyaRequest.mockImplementation((req: { path: string }) => {
        if (req.path === '/v2.0/apps/schema1/users') {
          return Promise.resolve({
            list: [
              { uid: 'u1', username: 'a@b.c' },
              { uid: 'u2', username: 'x@y.z' },
            ],
            total: 2,
            has_more: false,
          });
        }
        if (req.path === '/v1.0/users/u1/infos') {
          return Promise.resolve({
            uid: 'u1',
            nick_name: 'Huy',
            avatar: 'https://img/x.png',
          });
        }
        return Promise.reject(new Error('detail down'));
      });

      const res = await svc.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list[0].nick_name).toBe('Huy');
      expect(res.list[0].avatar).toBe('https://img/x.png');
      expect(res.list[1].nick_name).toBeUndefined(); // lỗi detail không chặn list
      expect(res.total).toBe(2);
    });
  });

  describe('getUserDevices', () => {
    it('gọi đúng path và lược bỏ local_key (secret)', async () => {
      tuyaRequest.mockResolvedValue([
        {
          id: 'd1',
          name: 'Ice Bath',
          online: true,
          local_key: 'SECRET',
          status: [{ code: 'temp_current', value: 5 }],
        },
      ]);

      const res = await service.getUserDevices('u1');

      expect(tuyaRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/v1.0/users/u1/devices',
        }),
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('d1');
      expect(res[0]).not.toHaveProperty('local_key');
    });

    it('Tuya trả null/undefined → mảng rỗng', async () => {
      tuyaRequest.mockResolvedValue(undefined);
      await expect(service.getUserDevices('u1')).resolves.toEqual([]);
    });
  });
});
