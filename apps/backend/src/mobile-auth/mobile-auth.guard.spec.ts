import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import { MobileAuthGuard } from './mobile-auth.guard';
import { DeviceOwnershipGuard } from './device-ownership.guard';

function ctx(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('MobileAuthGuard (api-key + uid)', () => {
  const config = {
    require: jest.fn().mockReturnValue('secret-key'),
  } as unknown as AppConfigService;
  const guard = new MobileAuthGuard(config);

  it('api-key đúng + có uid → pass + gắn req.uid', () => {
    const req: { headers: Record<string, string>; uid?: string } = {
      headers: { 'x-api-key': 'secret-key', 'x-tuya-uid': 'uid-1' },
    };
    expect(guard.canActivate(ctx(req))).toBe(true);
    expect(req.uid).toBe('uid-1');
  });

  it('api-key sai → 401', () => {
    const req = { headers: { 'x-api-key': 'wrong', 'x-tuya-uid': 'uid-1' } };
    expect(() => guard.canActivate(ctx(req))).toThrow(UnauthorizedException);
  });

  it('thiếu uid → 401', () => {
    const req = { headers: { 'x-api-key': 'secret-key' } };
    expect(() => guard.canActivate(ctx(req))).toThrow(UnauthorizedException);
  });
});

describe('DeviceOwnershipGuard (deviceId ∈ uid)', () => {
  const getUserDevices = jest.fn();
  const users = { getUserDevices } as unknown as UsersService;
  const guard = new DeviceOwnershipGuard(users);

  beforeEach(() => jest.clearAllMocks());

  it('device thuộc uid → pass', async () => {
    getUserDevices.mockResolvedValue([{ id: 'dev-1' }, { id: 'dev-2' }]);
    const req = { uid: 'uid-1', params: { deviceId: 'dev-2' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(getUserDevices).toHaveBeenCalledWith('uid-1');
  });

  it('device KHÔNG thuộc uid → 403', async () => {
    getUserDevices.mockResolvedValue([{ id: 'dev-1' }]);
    const req = { uid: 'uid-1', params: { deviceId: 'dev-999' } };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('chưa xác thực uid → 401', async () => {
    const req = { params: { deviceId: 'dev-1' } };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
