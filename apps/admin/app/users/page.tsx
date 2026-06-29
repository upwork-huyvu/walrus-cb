import Link from 'next/link';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type UserRow = {
  uid: string;
  username?: string;
  email?: string;
  country_code?: string;
  business?: { deviceCount?: number };
};

type ListResponse = {
  list: UserRow[];
  total: number;
  has_more: boolean;
  page_no: number;
  page_size: number;
};

const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const data = await apiGet<ListResponse>(
    `/users?page_no=${page}&page_size=${PAGE_SIZE}`,
  );

  return (
    <main>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Người dùng Tuya</h1>
        <p className="page-sub">
          Nguồn: Tuya Cloud (end-user đăng ký qua app) · ghép business data từ Supabase
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>UID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Quốc gia</th>
            <th>Thiết bị (DB)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.list.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                Chưa có user Tuya — kiểm tra backend đang chạy + đã set TUYA_APP_SCHEMA / Tuya Cloud creds.
              </td>
            </tr>
          ) : (
            data.list.map((u) => (
              <tr key={u.uid}>
                <td>{u.uid}</td>
                <td>{u.username ?? '—'}</td>
                <td>{u.email ?? '—'}</td>
                <td>{u.country_code ?? '—'}</td>
                <td>{u.business?.deviceCount ?? 0}</td>
                <td>
                  <Link href={`/users/${u.uid}`}>Chi tiết</Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pager">
        {page > 1 ? (
          <Link href={`/users?page=${page - 1}`}>← Trước</Link>
        ) : (
          <span className="muted">← Trước</span>
        )}
        <span className="muted">Trang {page}</span>
        {data.has_more ? (
          <Link href={`/users?page=${page + 1}`}>Sau →</Link>
        ) : (
          <span className="muted">Sau →</span>
        )}
        <span className="muted">· Tổng {data.total}</span>
      </div>
    </main>
  );
}
