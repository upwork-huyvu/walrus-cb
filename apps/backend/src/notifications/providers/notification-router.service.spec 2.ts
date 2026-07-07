import { AppConfigService } from '../../config/app-config.service';
import { NotificationRouterService } from './notification-router.service';
import { TuyaNotificationProvider } from './tuya.provider';
import { FcmNotificationProvider } from './fcm.provider';
import type { SendOutcome } from './notification-provider';

describe('NotificationRouterService (chọn provider theo NOTIFICATION_PROVIDER)', () => {
  const tuyaSend = jest.fn();
  const fcmSend = jest.fn();
  const configGet = jest.fn();

  const tuya = {
    name: 'tuya',
    send: tuyaSend,
  } as unknown as TuyaNotificationProvider;
  const fcm = {
    name: 'fcm',
    send: fcmSend,
  } as unknown as FcmNotificationProvider;
  const config = { get: configGet } as unknown as AppConfigService;

  const outcome = (p: 'tuya' | 'fcm'): SendOutcome => ({
    provider: p,
    total: 1,
    success: 1,
    failed: 0,
  });

  let router: NotificationRouterService;
  beforeEach(() => {
    jest.clearAllMocks();
    tuyaSend.mockResolvedValue(outcome('tuya'));
    fcmSend.mockResolvedValue(outcome('fcm'));
    router = new NotificationRouterService(config, tuya, fcm);
  });

  const input = { title: 'T', body: 'B', uids: ['u1'] };

  it('provider=fcm → gọi FcmProvider, KHÔNG gọi Tuya', async () => {
    configGet.mockReturnValue('fcm');
    const r = await router.send(input);
    expect(fcmSend).toHaveBeenCalledWith(input);
    expect(tuyaSend).not.toHaveBeenCalled();
    expect(r.provider).toBe('fcm');
    expect(router.activeProvider()).toBe('fcm');
  });

  it('provider=tuya → gọi TuyaProvider', async () => {
    configGet.mockReturnValue('tuya');
    const r = await router.send(input);
    expect(tuyaSend).toHaveBeenCalledWith(input);
    expect(fcmSend).not.toHaveBeenCalled();
    expect(r.provider).toBe('tuya');
  });

  it('config thiếu/undefined → default TUYA', async () => {
    configGet.mockReturnValue(undefined);
    await router.send(input);
    expect(tuyaSend).toHaveBeenCalled();
    expect(fcmSend).not.toHaveBeenCalled();
    expect(router.activeProvider()).toBe('tuya');
  });
});
