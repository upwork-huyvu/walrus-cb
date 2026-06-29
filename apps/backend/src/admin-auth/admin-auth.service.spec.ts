import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService.getAdminFromToken', () => {
  const findUnique = jest.fn();
  const requireFn = jest.fn();
  const fetchMock = jest.fn();

  const config = { require: requireFn } as unknown as AppConfigService;
  const prisma = {
    adminUser: { findUnique },
  } as unknown as PrismaService;
  let service: AdminAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    requireFn.mockImplementation((k: string) =>
      k === 'SUPABASE_URL' ? 'https://x.supabase.co' : 'anon-key',
    );
    global.fetch = fetchMock;
    service = new AdminAuthService(config, prisma);
  });

  it('token hợp lệ + có trong admin_users → trả admin', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'u1', email: 'a@b.c' }),
    });
    findUnique.mockResolvedValue({ id: 'adm', email: 'a@b.c' });

    await expect(service.getAdminFromToken('tok')).resolves.toEqual({
      id: 'u1',
      email: 'a@b.c',
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.c' } });
  });

  it('token hợp lệ nhưng không trong allowlist → Forbidden', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'u1', email: 'no@b.c' }),
    });
    findUnique.mockResolvedValue(null);

    await expect(service.getAdminFromToken('tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('Supabase trả lỗi → Unauthorized', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    await expect(service.getAdminFromToken('tok')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
