import { AppConfigService } from '../config/app-config.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (Tuya Cloud App Push)', () => {
  const tuyaRequest = jest.fn();
  const configRequire = jest.fn();
  const usersList = jest.fn();

  const tuya = { request: tuyaRequest } as unknown as TuyaCloudService;
  const config = { require: configRequire } as unknown as AppConfigService;
  const users = { listUsers: usersList } as unknown as UsersService;

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    configRequire.mockReturnValue(10); // TUYA_APP_BIZ_TYPE
    service = new NotificationsService(tuya, config, users);
  });

  describe('sendPush', () => {
    it('1 uid → gọi đúng path + body, biz_type từ config, template_param là chuỗi JSON', async () => {
      tuyaRequest.mockResolvedValue({ send_status: true });

      const res = await service.sendPush({
        uids: ['u1'],
        templateId: 'PUSH_1',
        params: { code: '1234' },
      });

      expect(res).toEqual({
        total: 1,
        success: 1,
        failed: 0,
        results: [{ uid: 'u1', ok: true }],
      });
      expect(tuyaRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1.0/iot-03/messages/app-notifications/actions/push',
        body: {
          uid: 'u1',
          biz_type: 10,
          template_id: 'PUSH_1',
          template_param: '{"code":"1234"}',
        },
      });
    });

    it('không có params → template_param = "{}"', async () => {
      tuyaRequest.mockResolvedValue({ send_status: true });

      await service.sendPush({ uids: ['u2'], templateId: 'PUSH_2' });

      expect(tuyaRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ template_param: '{}' }),
        }),
      );
    });

    it('nhiều uid → loop per-uid + tổng hợp thành công', async () => {
      tuyaRequest.mockResolvedValue({ send_status: true });

      const res = await service.sendPush({
        uids: ['a', 'b', 'c'],
        templateId: 'PUSH_M',
      });

      expect(tuyaRequest).toHaveBeenCalledTimes(3);
      expect(res).toMatchObject({ total: 3, success: 3, failed: 0 });
    });

    it('1 uid lỗi → KHÔNG throw, ghi vào results (ok:false) + failed count, uid khác vẫn chạy', async () => {
      tuyaRequest
        .mockResolvedValueOnce({ send_status: true }) // a
        .mockRejectedValueOnce(new Error('Tuya API lỗi')) // b
        .mockResolvedValueOnce({ send_status: true }); // c

      const res = await service.sendPush({
        uids: ['a', 'b', 'c'],
        templateId: 'PUSH_E',
      });

      expect(res.total).toBe(3);
      expect(res.success).toBe(2);
      expect(res.failed).toBe(1);
      expect(res.results).toContainEqual({
        uid: 'b',
        ok: false,
        error: 'Tuya API lỗi',
      });
    });

    it('all=true → enumerate uid qua users.listUsers (phân trang) rồi push từng uid', async () => {
      usersList
        .mockResolvedValueOnce({
          list: [{ uid: 'p1' }, { uid: 'p2' }],
          has_more: true,
        })
        .mockResolvedValueOnce({ list: [{ uid: 'p3' }], has_more: false });
      tuyaRequest.mockResolvedValue({ send_status: true });

      const res = await service.sendPush({ all: true, templateId: 'PUSH_ALL' });

      expect(usersList).toHaveBeenCalledTimes(2);
      expect(tuyaRequest).toHaveBeenCalledTimes(3);
      expect(res).toMatchObject({ total: 3, success: 3 });
    });
  });

  describe('templates', () => {
    it('listTemplates → GET đúng path', async () => {
      tuyaRequest.mockResolvedValue({ list: [] });
      await service.listTemplates();
      expect(tuyaRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1.0/iot-03/msg-templates/app-notifications',
      });
    });

    it('getTemplate → GET path kèm id', async () => {
      tuyaRequest.mockResolvedValue({ template_id: 'PUSH_9' });
      await service.getTemplate('PUSH_9');
      expect(tuyaRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/v1.0/iot-03/msg-templates/app-notifications/PUSH_9',
      });
    });

    it('createTemplate → POST đúng path + body', async () => {
      tuyaRequest.mockResolvedValue({ template_id: 'PUSH_NEW' });
      const res = await service.createTemplate({
        name: 'Nhắc filter',
        title: 'Thay bộ lọc',
        content: 'Bộ lọc ${device} đã dùng ${days} ngày',
        type: 0,
        remark: 'Nhắc bảo trì',
      });
      expect(res).toEqual({ template_id: 'PUSH_NEW' });
      expect(tuyaRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/v1.0/iot-03/msg-templates/app-notifications',
        body: {
          name: 'Nhắc filter',
          title: 'Thay bộ lọc',
          content: 'Bộ lọc ${device} đã dùng ${days} ngày',
          type: 0,
          remark: 'Nhắc bảo trì',
        },
      });
    });
  });
});
