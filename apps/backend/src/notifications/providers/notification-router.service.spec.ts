import { AppConfigService } from '../../config/app-config.service';
import { NotificationLogService } from '../notification-log.service';
import { NotificationRouterService } from './notification-router.service';
import { TuyaNotificationProvider } from './tuya.provider';
import { FcmNotificationProvider } from './fcm.provider';
import type { SendOutcome } from './notification-provider';

describe('NotificationRouterService (chọn provider theo NOTIFICATION_PROVIDER)', () => {
  const tuyaSend = jest.fn();
  const fcmSend = jest.fn();
  const configGet = jest.fn();
  const recordFn = jest.fn();

  const tuya = {
    name: 'tuya',
    send: tuyaSend,
  } as unknown as TuyaNotificationProvider;
  const fcm = {
    name: 'fcm',
    send: fcmSend,
  } as unknown as FcmNotificationProvider;
  const config = { get: configGet } as unknown as AppConfigService;
  const log = { record: recordFn } as unknown as NotificationLogService;

  const outcome = (
    p: 'tuya' | 'fcm',
    deliveredUids?: string[],
  ): SendOutcome => ({
    provider: p,
    total: 1,
    success: 1,
    failed: 0,
    ...(deliveredUids ? { deliveredUids } : {}),
  });

  let router: NotificationRouterService;
  beforeEach(() => {
    jest.clearAllMocks();
    tuyaSend.mockResolvedValue(outcome('tuya'));
    fcmSend.mockResolvedValue(outcome('fcm', ['u1']));
    recordFn.mockResolvedValue(undefined);
    router = new NotificationRouterService(config, tuya, fcm, log);
  });

  const input = { title: 'T', body: 'B', uids: ['u1'] };

  it('provider=fcm → gọi FcmProvider + GHI lịch sử theo deliveredUids, KHÔNG gọi Tuya', async () => {
    configGet.mockReturnValue('fcm');
    const r = await router.send(input);
    expect(fcmSend).toHaveBeenCalledWith(input);
    expect(tuyaSend).not.toHaveBeenCalled();
    expect(r.provider).toBe('fcm');
    expect(router.activeProvider()).toBe('fcm');
    expect(recordFn).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ title: 'T', body: 'B', provider: 'fcm' }),
    );
  });

  it('fcm: CHỈ log uid thật sự nhận (deliveredUids), bỏ uid gửi trượt', async () => {
    configGet.mockReturnValue('fcm');
    fcmSend.mockResolvedValue(outcome('fcm', ['u1'])); // gửi u1,u2 nhưng chỉ u1 nhận
    await router.send({ title: 'T', body: 'B', uids: ['u1', 'u2'] });
    expect(recordFn).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ provider: 'fcm' }),
    );
  });

  it('fcm: không ai nhận (deliveredUids rỗng) → KHÔNG ghi log', async () => {
    configGet.mockReturnValue('fcm');
    fcmSend.mockResolvedValue(outcome('fcm', []));
    await router.send(input);
    expect(recordFn).not.toHaveBeenCalled();
  });

  it('fcm: lỗi ghi log KHÔNG làm hỏng send (đã gửi xong)', async () => {
    configGet.mockReturnValue('fcm');
    recordFn.mockRejectedValue(new Error('DB down'));
    await expect(router.send(input)).resolves.toMatchObject({
      provider: 'fcm',
    });
  });

  it('provider=tuya → gọi TuyaProvider, KHÔNG ghi lịch sử (đã có Tuya Message Center)', async () => {
    configGet.mockReturnValue('tuya');
    const r = await router.send(input);
    expect(tuyaSend).toHaveBeenCalledWith(input);
    expect(fcmSend).not.toHaveBeenCalled();
    expect(r.provider).toBe('tuya');
    expect(recordFn).not.toHaveBeenCalled();
  });

  it('config thiếu/undefined → default TUYA', async () => {
    configGet.mockReturnValue(undefined);
    await router.send(input);
    expect(tuyaSend).toHaveBeenCalled();
    expect(fcmSend).not.toHaveBeenCalled();
    expect(router.activeProvider()).toBe('tuya');
    expect(recordFn).not.toHaveBeenCalled();
  });
});
