import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService, type AdminPrincipal } from './admin-auth.service';

const findUnique = jest.fn();
const create = jest.fn();
const del = jest.fn();
const requireFn = jest.fn();
const fetchMock = jest.fn();

const config = { require: requireFn } as unknown as AppConfigService;
const prisma = {
  adminUser: { findUnique, create, delete: del },
} as unknown as PrismaService;

const SUPER: AdminPrincipal = {
  id: 'u-super',
  email: 'admin@admin.com',
  role: AdminRole.SUPERADMIN,
};
const PLAIN: AdminPrincipal = {
  id: 'u-plain',
  email: 'staff@walrus.com',
  role: AdminRole.ADMIN,
};

let service: AdminAuthService;

beforeEach(() => {
  jest.clearAllMocks();
  requireFn.mockImplementation((k: string) => {
    if (k === 'SUPABASE_URL') return 'https://x.supabase.co';
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-key';
    return 'anon-key';
  });
  global.fetch = fetchMock;
  service = new AdminAuthService(config, prisma);
});

describe('AdminAuthService.getAdminFromToken', () => {
  it('token hợp lệ + có trong admin_users → trả admin kèm vai trò', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'u1', email: 'a@b.c' }),
    });
    findUnique.mockResolvedValue({
      id: 'adm',
      email: 'a@b.c',
      role: AdminRole.SUPERADMIN,
    });

    await expect(service.getAdminFromToken('tok')).resolves.toEqual({
      id: 'u1',
      email: 'a@b.c',
      role: AdminRole.SUPERADMIN,
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
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(service.getAdminFromToken('tok')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('AdminAuthService.createAdmin', () => {
  it('admin thường → Forbidden, không đụng gì tới Supabase', async () => {
    await expect(
      service.createAdmin(PLAIN, 'new@walrus.com', 'password123'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('email đã có quyền admin → Conflict', async () => {
    findUnique.mockResolvedValue({ id: 'adm', email: 'new@walrus.com' });
    await expect(
      service.createAdmin(SUPER, 'new@walrus.com', 'password123'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('tạo được tài khoản Supabase → thêm vào allowlist với vai trò ADMIN', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    create.mockResolvedValue({
      id: 'adm-new',
      email: 'new@walrus.com',
      role: AdminRole.ADMIN,
    });

    await expect(
      service.createAdmin(SUPER, '  New@Walrus.com ', 'password123'),
    ).resolves.toMatchObject({ email: 'new@walrus.com', created: true });

    // Email phải được chuẩn hoá về chữ thường, nếu không `assertAdmin` sẽ không tìm ra dòng này.
    expect(create).toHaveBeenCalledWith({
      data: { email: 'new@walrus.com', role: AdminRole.ADMIN },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://x.supabase.co/auth/v1/admin/users');
    expect(JSON.parse(init.body)).toMatchObject({
      email: 'new@walrus.com',
      email_confirm: true,
    });
  });

  it('email đã có tài khoản Supabase (422) → vẫn cấp quyền nhưng báo created=false', async () => {
    findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({}),
    });
    create.mockResolvedValue({
      id: 'adm-new',
      email: 'old@walrus.com',
      role: AdminRole.ADMIN,
    });

    await expect(
      service.createAdmin(SUPER, 'old@walrus.com', 'password123'),
    ).resolves.toMatchObject({ created: false });
    expect(create).toHaveBeenCalled();
  });
});

describe('AdminAuthService.changeOwnPassword', () => {
  it('mật khẩu mới trùng mật khẩu cũ → BadRequest', async () => {
    await expect(
      service.changeOwnPassword(PLAIN, 'same-pass', 'same-pass'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // 400 chứ không phải 401 - xem comment trong service: 401 sẽ bị admin web hiểu là hết phiên.
  it('mật khẩu hiện tại sai → BadRequest và KHÔNG gọi endpoint đổi mật khẩu', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(
      service.changeOwnPassword(PLAIN, 'wrong', 'password123'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('đúng mật khẩu hiện tại → PUT admin/users/{id} với mật khẩu mới', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    await expect(
      service.changeOwnPassword(PLAIN, 'old-pass', 'password123'),
    ).resolves.toEqual({ updated: true });

    const [url, init] = fetchMock.mock.calls[1] as [
      string,
      { method: string; body: string },
    ];
    expect(url).toBe('https://x.supabase.co/auth/v1/admin/users/u-plain');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ password: 'password123' });
  });
});

describe('AdminAuthService.deleteAdmin', () => {
  it('admin thường → Forbidden, không xoá gì', async () => {
    await expect(service.deleteAdmin('adm-1', PLAIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('gỡ chính superadmin → Forbidden (kể cả superadmin tự gỡ)', async () => {
    findUnique.mockResolvedValue({
      id: 'adm-super',
      email: 'admin@admin.com',
      role: AdminRole.SUPERADMIN,
    });
    await expect(
      service.deleteAdmin('adm-super', SUPER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(del).not.toHaveBeenCalled();
  });

  it('superadmin gỡ admin thường → xoá dòng allowlist', async () => {
    findUnique.mockResolvedValue({
      id: 'adm-1',
      email: 'staff@walrus.com',
      role: AdminRole.ADMIN,
    });
    del.mockResolvedValue({});

    await expect(service.deleteAdmin('adm-1', SUPER)).resolves.toEqual({
      deleted: true,
      email: 'staff@walrus.com',
    });
    expect(del).toHaveBeenCalledWith({ where: { id: 'adm-1' } });
  });
});
