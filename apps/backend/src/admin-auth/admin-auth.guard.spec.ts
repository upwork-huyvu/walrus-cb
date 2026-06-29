import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard, type AdminRequest } from './admin-auth.guard';

function makeCtx(headers: Record<string, string | undefined>): {
  ctx: ExecutionContext;
  req: AdminRequest;
} {
  const req = { headers } as unknown as AdminRequest;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AdminAuthGuard', () => {
  const getAdminFromToken = jest.fn();
  const auth = { getAdminFromToken } as unknown as AdminAuthService;
  let guard: AdminAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AdminAuthGuard(auth);
  });

  it('thiếu Bearer → Unauthorized', async () => {
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(getAdminFromToken).not.toHaveBeenCalled();
  });

  it('admin hợp lệ → true + gắn req.admin', async () => {
    getAdminFromToken.mockResolvedValue({ id: 'a1', email: 'a@b.c' });
    const { ctx, req } = makeCtx({ authorization: 'Bearer tok' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(getAdminFromToken).toHaveBeenCalledWith('tok');
    expect(req.admin).toEqual({ id: 'a1', email: 'a@b.c' });
  });

  it('không phải admin → Forbidden propagate', async () => {
    getAdminFromToken.mockRejectedValue(new ForbiddenException());
    const { ctx } = makeCtx({ authorization: 'Bearer tok' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
