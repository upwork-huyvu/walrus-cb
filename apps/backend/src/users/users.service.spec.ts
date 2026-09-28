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
  const listDeletedUids = jest.fn();
  const removeByUid = jest.fn();
  const deleteMany = jest.fn();
  const configGet = jest.fn();

  const pushFindMany = jest.fn();
  const reminderFindMany = jest.fn();

  const tuya = { request: tuyaRequest } as unknown as TuyaCloudService;
  const prisma = {
    deviceMapping: { deleteMany },
    pushToken: { findMany: pushFindMany },
    deviceReminder: { findMany: reminderFindMany },
  } as unknown as PrismaService;
  const jobs = {
    enqueue,
    markDone,
    markFailure,
    listPending,
    listDeletedUids,
    removeByUid,
  } as unknown as DeleteJobsService;
  const configRequire = jest.fn().mockReturnValue('schema1');
  const config = {
    get: configGet,
    require: configRequire,
  } as unknown as AppConfigService;

  /** Tuya giả cho roster: app list trả `appUids`, `/infos` + `/devices` tra theo bảng. */
  function routeTuya(opts: {
    appUids?: string[];
    appListFails?: boolean;
    infos?: Record<string, Record<string, unknown>>;
    devices?: Record<string, unknown[]>;
  }) {
    tuyaRequest.mockImplementation((req: { path: string }) => {
      if (req.path.startsWith('/v2.0/apps/')) {
        if (opts.appListFails) return Promise.reject(new Error('1106'));
        return Promise.resolve({
          list: (opts.appUids ?? []).map((uid) => ({ uid })),
          total: (opts.appUids ?? []).length,
          has_more: false,
        });
      }
      const m = /^\/v1\.0\/users\/([^/]+)\/(infos|devices)$/.exec(req.path);
      if (m) {
        const [, uid, kind] = m;
        const hit = (kind === 'infos' ? opts.infos : opts.devices)?.[uid];
        // Không khai trong bảng = Tuya từ chối (uid app cũ / DC đã khoá).
        return hit === undefined
          ? Promise.reject(new Error(`permission deny ${uid}`))
          : Promise.resolve(hit);
      }
      return Promise.reject(new Error(`path lạ: ${req.path}`));
    });
  }

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    configGet.mockReturnValue('postgres://x'); // DATABASE_URL có → cleanup chạy
    listDeletedUids.mockResolvedValue([]); // mặc định: thùng rác rỗng → listUsers không lọc ai
    pushFindMany.mockResolvedValue([]);
    reminderFindMany.mockResolvedValue([]);
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

  describe('listUsers (roster gộp Tuya + DB)', () => {
    // ĐÂY LÀ LỖI GỐC đã đo trên hệ thống thật: `GET /v2.0/apps/{schema}/users` chỉ trả 2/6 user
    // còn sống, trong số bị bỏ sót có người đang sở hữu bồn ONLINE. Backend phải bù bằng uid
    // chính nó đã lưu, nếu không admin không bao giờ thấy khách đó.
    it('gộp uid backend đã lưu vào danh sách khi Tuya bỏ sót', async () => {
      pushFindMany.mockResolvedValue([{ tuyaUid: 'missed' }]);
      routeTuya({
        appUids: ['listed'],
        infos: {
          listed: { nick_name: 'Listed', create_time: 200 },
          missed: { nick_name: 'Missed', create_time: 100 },
        },
        devices: { listed: [], missed: [{ id: 'd1' }] },
      });

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list.map((u) => u.uid)).toEqual(['listed', 'missed']);
      expect(res.total).toBe(2);
      expect(res.list[1].nick_name).toBe('Missed');
      expect(res.list[1].business.deviceCount).toBe(1);
    });

    it('lấy uid từ cả push_tokens lẫn device_reminders, không trùng lặp', async () => {
      pushFindMany.mockResolvedValue([{ tuyaUid: 'a' }, { tuyaUid: 'b' }]);
      reminderFindMany.mockResolvedValue([{ tuyaUid: 'b' }, { tuyaUid: 'c' }]);
      routeTuya({
        appUids: ['a'],
        infos: { a: {}, b: {}, c: {} },
        devices: { a: [], b: [], c: [] },
      });

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list.map((u) => u.uid).sort()).toEqual(['a', 'b', 'c']);
    });

    // uid của app SDK cũ / data center đã khoá: Tuya trả 1106. Một dòng trống không bấm được
    // còn tệ hơn là không có dòng nào.
    it('bỏ uid mà Tuya từ chối trả /infos', async () => {
      pushFindMany.mockResolvedValue([{ tuyaUid: 'dead' }]);
      routeTuya({ appUids: ['ok'], infos: { ok: {} }, devices: { ok: [] } });

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list.map((u) => u.uid)).toEqual(['ok']);
      expect(res.total).toBe(1);
    });

    // Bẫy: đếm hụt mà trả 0 thì admin gắn nhãn "Inactive" cho khách đang có bồn chạy.
    it('đếm thiết bị hụt → deviceCount null, KHÔNG phải 0', async () => {
      routeTuya({ appUids: ['u1'], infos: { u1: {} } }); // bảng devices rỗng → reject

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list[0].business.deviceCount).toBeNull();
    });

    it('đếm thiết bị từ Tuya chứ không từ bảng device_mappings', async () => {
      routeTuya({
        appUids: ['u1'],
        infos: { u1: {} },
        devices: { u1: [{ id: 'd1' }, { id: 'd2' }] },
      });

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list[0].business.deviceCount).toBe(2);
    });

    // Tuya `pre-delete` giữ user trong response suốt 7 ngày ân hạn → phải tự lọc, nếu không admin
    // bấm xoá xong vẫn thấy y nguyên (đúng lỗi QA báo).
    it('loại user đã yêu cầu xoá khỏi danh sách và trừ vào total', async () => {
      listDeletedUids.mockResolvedValue(['u1']);
      routeTuya({
        appUids: ['u1', 'u2'],
        infos: { u1: {}, u2: {} },
        devices: { u1: [], u2: [] },
      });

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list.map((u) => u.uid)).toEqual(['u2']);
      expect(res.total).toBe(1);
    });

    it('phân trang tại chỗ: total/has_more khớp số dòng thật', async () => {
      routeTuya({
        appUids: ['a', 'b', 'c'],
        infos: {
          a: { create_time: 3 },
          b: { create_time: 2 },
          c: { create_time: 1 },
        },
        devices: { a: [], b: [], c: [] },
      });

      const p1 = await service.listUsers({ page_no: 1, page_size: 2 });
      expect(p1.list.map((u) => u.uid)).toEqual(['a', 'b']); // mới nhất trước
      expect(p1.total).toBe(3);
      expect(p1.has_more).toBe(true);

      const p2 = await service.listUsers({ page_no: 2, page_size: 2 });
      expect(p2.list.map((u) => u.uid)).toEqual(['c']);
      expect(p2.has_more).toBe(false);
    });

    // Danh sách app hỏng (sai schema, Tuya 5xx) không được làm trắng cả trang admin.
    it('danh sách app của Tuya lỗi → vẫn dựng roster từ DB', async () => {
      pushFindMany.mockResolvedValue([{ tuyaUid: 'fromDb' }]);
      routeTuya({
        appListFails: true,
        infos: { fromDb: { nick_name: 'Db' } },
        devices: { fromDb: [] },
      });

      const res = await service.listUsers({ page_no: 1, page_size: 20 });

      expect(res.list.map((u) => u.uid)).toEqual(['fromDb']);
    });
  });

  describe('restoreUser (huỷ pre-delete)', () => {
    it('gọi cancel-delete rồi mới gỡ bản ghi job', async () => {
      tuyaRequest.mockResolvedValue(true);

      const res = await service.restoreUser('u9');

      expect(tuyaRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1.0/users/u9/actions/cancel-delete',
      });
      expect(removeByUid).toHaveBeenCalledWith('u9');
      expect(res).toEqual({ uid: 'u9', restored: true });
    });

    // Bẫy: gỡ job trước rồi Tuya lỗi ⇒ user hiện lại trong admin nhưng Tuya VẪN xoá khi hết hạn.
    // Khôi phục nửa vời còn tệ hơn không khôi phục - test này khoá đúng thứ tự đó.
    it('Tuya lỗi → KHÔNG gỡ bản ghi job, ném lỗi ra ngoài', async () => {
      tuyaRequest.mockRejectedValue(new Error('cancel-delete failed'));

      await expect(service.restoreUser('u9')).rejects.toThrow(
        'cancel-delete failed',
      );
      expect(removeByUid).not.toHaveBeenCalled();
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
