import { PushService } from './push.service';
import type { PushTokensService } from './push-tokens.service';
import type { FirebaseMessaging } from './firebase.provider';

function makeTokens(list: string[], allUids: string[] = []) {
  return {
    listTokensByUid: jest.fn().mockResolvedValue(list),
    listAllUids: jest.fn().mockResolvedValue(allUids),
    pruneTokens: jest.fn().mockResolvedValue(undefined),
  } as unknown as PushTokensService & {
    listTokensByUid: jest.Mock;
    listAllUids: jest.Mock;
    pruneTokens: jest.Mock;
  };
}

// messaging trả về theo token: token bắt đầu 'ok' → success, còn lại → fail.
function fakeMessaging() {
  const send = jest.fn(({ tokens }: { tokens: string[] }) =>
    Promise.resolve({
      successCount: tokens.filter((t) => t.startsWith('ok')).length,
      failureCount: tokens.filter((t) => !t.startsWith('ok')).length,
      responses: tokens.map((t) =>
        t.startsWith('ok')
          ? { success: true }
          : { success: false, error: { code: 'x' } },
      ),
    }),
  );
  return { sendEachForMulticast: send } as unknown as FirebaseMessaging;
}

describe('PushService.sendToUid', () => {
  const payload = { title: 'T', body: 'B' };

  it('FCM chưa cấu hình (messaging null) → skipped, không gọi token', async () => {
    const tokens = makeTokens([]);
    const svc = new PushService(null as FirebaseMessaging, tokens);
    const res = await svc.sendToUid('uid1', payload);
    expect(res).toEqual({ sent: 0, failed: 0, pruned: 0, skipped: true });
    expect(tokens.listTokensByUid).not.toHaveBeenCalled();
  });

  it('user không có token → skipped, không gọi FCM', async () => {
    const tokens = makeTokens([]);
    const send = jest.fn();
    const svc = new PushService(
      { sendEachForMulticast: send } as unknown as FirebaseMessaging,
      tokens,
    );
    const res = await svc.sendToUid('uid1', payload);
    expect(res.skipped).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('gửi tới nhiều token → đếm sent/failed; token chết bị prune', async () => {
    const tokens = makeTokens(['tok_ok', 'tok_dead', 'tok_other_err']);
    const send = jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
        {
          success: false,
          error: { code: 'messaging/internal-error', message: 'oops' },
        },
      ],
    });
    const svc = new PushService(
      { sendEachForMulticast: send } as unknown as FirebaseMessaging,
      tokens,
    );
    const res = await svc.sendToUid('uid1', payload);

    expect(send).toHaveBeenCalledWith({
      tokens: ['tok_ok', 'tok_dead', 'tok_other_err'],
      notification: { title: 'T', body: 'B' },
      data: undefined,
    });
    expect(res).toEqual({ sent: 1, failed: 2, pruned: 1 });
    // Chỉ token 'not-registered' bị prune; lỗi internal-error KHÔNG prune (có thể tạm thời).
    expect(tokens.pruneTokens).toHaveBeenCalledWith(['tok_dead']);
  });
});

describe('PushService.sendToUids / sendToAll', () => {
  const payload = { title: 'T', body: 'B' };

  it('sendToUids: uid có token nhận được → success; uid không token → failed', async () => {
    // uid_a có token 'ok1'; uid_b không token (listTokensByUid trả [] ở lần 2).
    const tokens = makeTokens([]);
    (tokens.listTokensByUid as jest.Mock)
      .mockResolvedValueOnce(['ok1'])
      .mockResolvedValueOnce([]);
    const svc = new PushService(fakeMessaging(), tokens);
    const res = await svc.sendToUids(['uid_a', 'uid_b'], payload);
    expect(res).toEqual({ total: 2, success: 1, failed: 1 });
  });

  it('sendToAll: lấy distinct uid rồi gửi từng người', async () => {
    const tokens = makeTokens(['ok1'], ['uid_x', 'uid_y']);
    const svc = new PushService(fakeMessaging(), tokens);
    const res = await svc.sendToAll(payload);
    expect(tokens.listAllUids).toHaveBeenCalled();
    expect(res).toEqual({ total: 2, success: 2, failed: 0 });
  });
});
