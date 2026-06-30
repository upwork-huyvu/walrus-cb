import { AppConfigService } from '../config/app-config.service';
import { TuyaCloudService } from '../tuya/tuya-cloud.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (Tuya Cloud App Push)', () => {
  const tuyaRequest = jest.fn();
  const configRequire = jest.fn();

  const tuya = { request: tuyaRequest } as unknown as TuyaCloudService;
  const config = { require: configRequire } as unknown as AppConfigService;

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    configRequire.mockReturnValue(10); // TUYA_APP_BIZ_TYPE
    service = new NotificationsService(tuya, config);
  });

  describe('sendPush', () => {
    it('gọi đúng path + body, biz_type từ config, template_param là chuỗi JSON', async () => {
      tuyaRequest.mockResolvedValue({ send_status: true });

      const res = await service.sendPush({
        uid: 'u1',
        templateId: 'PUSH_1',
        params: { code: '1234' },
      });

      expect(res).toEqual({ send_status: true });
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

      await service.sendPush({ uid: 'u2', templateId: 'PUSH_2' });

      expect(tuyaRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ template_param: '{}' }),
        }),
      );
    });

    it('lỗi Tuya (request throw) nổi lên cho caller', async () => {
      tuyaRequest.mockRejectedValue(new Error('Tuya API lỗi'));
      await expect(
        service.sendPush({ uid: 'u3', templateId: 'PUSH_3' }),
      ).rejects.toThrow('Tuya API lỗi');
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
