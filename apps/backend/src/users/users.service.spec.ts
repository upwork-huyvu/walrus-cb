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
});
