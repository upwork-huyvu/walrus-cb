import { NotificationRouterService } from '../notifications/providers/notification-router.service';
import { RemindersCronService } from './reminders-cron.service';
import { RemindersService } from './reminders.service';
import type { DueReminder } from './reminders.types';

describe('RemindersCronService.processDue', () => {
  const scanDue = jest.fn();
  const markNotified = jest.fn();
  const send = jest.fn();
  const reminders = { scanDue, markNotified } as unknown as RemindersService;
  const router = { send } as unknown as NotificationRouterService;
  const cron = new RemindersCronService(reminders, router);

  beforeEach(() => jest.clearAllMocks());

  const due = (over: Partial<DueReminder> = {}): DueReminder => ({
    tuyaUid: 'u1',
    deviceId: 'd1',
    stage: 'soon',
    daysRemaining: 5,
    ...over,
  });

  it('mỗi reminder due → gửi push per-uid + markNotified đúng stage', async () => {
    scanDue.mockResolvedValue([
      due({ deviceId: 'd1', tuyaUid: 'u1', stage: 'soon' }),
    ]);
    send.mockResolvedValue({
      provider: 'fcm',
      total: 1,
      success: 1,
      failed: 0,
    });
    const res = await cron.processDue();
    expect(send).toHaveBeenCalledTimes(1);
    const calls = send.mock.calls as Array<
      [{ uids: string[]; title: string; body: string }]
    >;
    const arg = calls[0][0];
    expect(arg.uids).toEqual(['u1']);
    expect(typeof arg.title).toBe('string');
    expect(typeof arg.body).toBe('string');
    expect(markNotified).toHaveBeenCalledWith('d1', 'soon');
    expect(res).toEqual({ scanned: 1, notified: 1, failed: 0 });
  });

  it('gửi lỗi → KHÔNG markNotified (để cron sau thử lại), failed++', async () => {
    scanDue.mockResolvedValue([due()]);
    send.mockRejectedValue(new Error('push down'));
    const res = await cron.processDue();
    expect(markNotified).not.toHaveBeenCalled();
    expect(res).toEqual({ scanned: 1, notified: 0, failed: 1 });
  });

  it('không có reminder due → không gửi gì', async () => {
    scanDue.mockResolvedValue([]);
    const res = await cron.processDue();
    expect(send).not.toHaveBeenCalled();
    expect(res).toEqual({ scanned: 0, notified: 0, failed: 0 });
  });

  it('overdue → title khác (nội dung theo mốc)', async () => {
    scanDue.mockResolvedValue([due({ stage: 'overdue', daysRemaining: -3 })]);
    send.mockResolvedValue({
      provider: 'tuya',
      total: 1,
      success: 1,
      failed: 0,
    });
    await cron.processDue();
    const calls = send.mock.calls as Array<[{ title: string }]>;
    expect(calls[0][0].title.toLowerCase()).toContain('overdue');
  });
});
